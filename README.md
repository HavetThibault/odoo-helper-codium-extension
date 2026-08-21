## odoo-helper

### Features

- Run test under cursor, if the cursor is in the body of a python test method, it will run this test using the `o` script.
- Show the active file history in the console using `tig blame`.
- Move the variable under the cursor to the setupClass of a test class. You'll be prompted the name of the variable.

### Extension Settings

This extension contributes the following settings:

* `odoo-helpers.run-python-unit-test`: Run the test under the cursor.
* `odoo-helpers.run-tig-blame`: Run `tig blame` on the active file.
* `odoo-helpers.python-move-var-to-setup`: Move the variable under the cursor to the setupClass method.
