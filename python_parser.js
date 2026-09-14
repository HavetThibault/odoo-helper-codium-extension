// @ts-nocheck
const vscode = require('vscode');
const common = require('./common');

const startsWith = common.startsWith;

const stringDels = ['\'', '"'];
const openingCharsSet = ['{', '[', '('];
const closingCharsSet = ['}', ']', ')'];
const assignmentLineReg = /[a-zA-Z0-9_]+\s*=\s*[a-zA-Z0-9_\[\{\(]/;

function areCharMatching(open, close) {
    return open == '{' && close == '}'
        || open == '(' && close == ')'
        || open == '[' && close == ']';
}

/**
 * @param {vscode.TextEditor} textEditor
 */
function getAssignmentStartEnd(textEditor) {
    let line = textEditor.selection.start.line;
    const startLine = line;
    const delimiterChars = [];
    let assignmentLine = null;
    let assignmentTextLine = null;
    let waitingMatchChars = [];
    let goUp = true;
    let firstClosingDelimiterCol = null;
	while (true) {
		const originTextLine = textEditor.document.lineAt(line).text;
        const textLine = originTextLine.trimStart();
        if (startsWith(textLine, 'def ') || line < 0 || line >= textEditor.document.lineCount) {
            throw Error('Found the function definition or reached edge of the file before completing the assignment!');
        }
        if (textLine.length == 0) {
            if (goUp) {
                line--;
            } else {
                line++;
            }
            continue
        }
        let i = goUp ? (textLine.length - 1) : 0;
        while (i >= 0 && goUp || i < textLine.length && !goUp) {
            const char = textLine.at(i);
            let foundDelimiter = false;
            let foundMatch = false;
            if (openingCharsSet.includes(char)) {
                foundDelimiter = true;
                if (waitingMatchChars.length >= 1 && goUp) {
                    let delimiterPotentialPair = waitingMatchChars.at(0);
                    if (closingCharsSet.includes(delimiterPotentialPair)) {
                        if (!areCharMatching(char, delimiterPotentialPair)) {
                            throw Error('At line ' + line + ', found ' + char + ' and ' + delimiterPotentialPair + ' aren\t matching!');
                        }
                        waitingMatchChars.splice(0, 1);
                        foundMatch = true;
                    }
                }
            }
            else if (closingCharsSet.includes(char)) {
                foundDelimiter = true;
                if ( firstClosingDelimiterCol === null) {
                    firstClosingDelimiterCol = i;
                }
                if (waitingMatchChars.length >= 1 && !goUp) {
                    let delimiterPotentialPair = waitingMatchChars.at(-1);
                    if (openingCharsSet.includes(delimiterPotentialPair)) {
                        if (!areCharMatching(delimiterPotentialPair, char)) {
                            throw Error('At line ' + line + ', found ' + delimiterPotentialPair + ' and ' + char + ' aren\t matching!');
                        }
                        waitingMatchChars.pop();
                        foundMatch = true;
                    }
                }
            }

            if (foundDelimiter) {
                if (!foundMatch) {
                    goUp ? waitingMatchChars.splice(0, 0, char) : waitingMatchChars.push(char);
                }
                goUp ? delimiterChars.splice(0, 0, char) : delimiterChars.push(char);
            }
            if (!goUp && waitingMatchChars.length == 0) {
                const columnStartAssignment = assignmentTextLine.search(/=\s*/) + 1 + (assignmentTextLine.match(/=\s*/)[0].length - 1);
                return {
                    'startLine': new vscode.Position(assignmentLine, columnStartAssignment),
                    'endLine': new vscode.Position(line, i + originTextLine.match(/\s*/)[0].length + 1),
                };
            }
            if (goUp){
                i--;
            } else {
                i++;
            }
        }
        if (assignmentLineReg.test(textLine)) {
            if (!goUp) {
                throw Error('Found an assignment before the end of the previous assignment!')
            }
            goUp = false;
            assignmentLine = line;
            assignmentTextLine = originTextLine;
            if (waitingMatchChars.length == 0) {
                const columnStartAssignment = assignmentTextLine.search(/=\s*/) + 1 + (assignmentTextLine.match(/=\s*/)[0].length - 1);
                return {
                    'startLine': new vscode.Position(assignmentLine, columnStartAssignment),
                    'endLine': new vscode.Position(startLine, firstClosingDelimiterCol + textEditor.document.lineAt(startLine).text.match(/\s*/)[0].length + 1),
                };
            }
            line = startLine + 1;
        } else {
            if (goUp) {
                line--;
            } else {
                line++;
            }
        }
    }
}

function getIndent(line) {
    for (let spaceCount = 0; spaceCount <= line.length; spaceCount++) {
        if (line.at(spaceCount) !== ' ') {
            return spaceCount;
        }
    }
    throw Error('The line is full of white space or empty!');
}

function getElemStartEnd(textLine, selection) {
	let currentElem = undefined;
	const highestElems = [];
	for(let i = 0; i < textLine.length; i++) {
		if (currentElem === undefined) {
            const char = textLine.at(i);
			currentElem = createElem(i, char, undefined);
            if (currentElem !== undefined) {
                highestElems.push(currentElem);
            }
		}
		else if (currentElem.isNestedElemStart(textLine, i)) {
            const char = textLine.at(i);
			const newElem = createElem(i, char, currentElem);
			currentElem.addChild(newElem);
			currentElem = newElem;
		}
		else if (currentElem.isEnd(textLine, i)) {
			currentElem.end = i;
			currentElem = currentElem.parent;
		}
	}
	if (highestElems.length > 0) {
		const includingElement = getIncludingElement(selection.start.character, highestElems);
        if (includingElement !== undefined) {
            return includingElement.getMostNestedElement(selection.start.character);
        }
	}
	return undefined;
}

function getIncludingElement(pos, elems) {
    for (let i = 0; i < elems.length; i++) {
        if (elems[i].includes(pos)) {
            return elems[i].getMostNestedElement(pos);
        }
    }
    return undefined;
}

class PythonStruct {
	constructor(start, del, parent) {
		this.start = start;
		this.del = del;
		this.parent = parent;
		this.children = [];
		this.end = undefined;
	}

	isNestedElemStart(line, pos) {
		throw Error('Not implemented!');
	}

	isEnd(line, pos) {
		throw Error('Not implemented!');
	}

	addChild(child) {
		this.children.push(child);
	}

	getMostNestedElement(pos) {
        const includingElem = getIncludingElement(pos, this.children);
		return includingElem !== undefined ? includingElem : (this.includes(pos) ? this : undefined);
	}

	includes(pos) {
		return this.end !== undefined ? (this.start <= pos && this.end >= pos) : false;
	}
}

function createElem(start, del, parent) {
	if (openingCharsSet.includes(del)) {
		return new OpeningStruct(start, del, parent);
	}
	if (stringDels.includes(del)) {
		return new StringStruct(start, del, parent);
	}
	return;
}

class StringStruct extends PythonStruct {
	isNestedElemStart(line, pos) {
		if (pos == 0 || line.at(pos - 1) != '\\') {
			return line.at(pos) === '{';
		}
		return false;
	}

	isEnd(line, pos) {
        const char = line.at(pos);
		if (pos == 0 || line.at(pos - 1) != '\\') {
			return char === this.del;
		}
		return false;
	}
}

class OpeningStruct extends PythonStruct {
	isNestedElemStart(line, pos) {
		const char = line.at(pos);
		return openingCharsSet.includes(char) || stringDels.includes(char);
	}

	isEnd(line, pos) {
		return areCharMatching(this.del, line.at(pos));
	}
}

module.exports = { getAssignmentStartEnd, getIndent, getElemStartEnd };
