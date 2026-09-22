#!/usr/bin/env python3
"""Extract runbot branch links (repo + PR id) from a runbot build page."""

import argparse
import json
import sys
import os
import subprocess
from dataclasses import asdict, dataclass

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.options import Options


ALLOWED_REPOS = ('odoo/odoo', 'odoo/enterprise', 'odoo/upgrade')


@dataclass
class TaskLink:
    repos: str
    pr_id: str


def _find(element, by, selector):
    """Return the first match or None instead of raising."""
    try:
        return element.find_element(by, selector)
    except NoSuchElementException:
        return None


def _has_class(element, class_name):
    if element is None:
        return False
    return class_name in (element.get_attribute('class') or '').split()


def extract_tasks_links(driver):
    # find the <tr> whose first <td> is "Branches"
    row = _find(
        driver,
        By.XPATH,
        "//tr[td[1][normalize-space(.)='Branches']]",
    )
    if row is None:
        return []

    cells = row.find_elements(By.XPATH, './td')
    if len(cells) < 2:
        return []
    value_cell = cells[1]

    links = []
    for group in value_cell.find_elements(By.CSS_SELECTOR, 'div.btn-group'):
        branch_span = _find(
            group, By.CSS_SELECTOR, 'a[title="View Branch Details"] span'
        )
        if _has_class(branch_span, 'line-through'):
            continue

        repo_uri_elem = _find(group, By.CSS_SELECTOR, 'a[href="#"]')
        repos_uri = repo_uri_elem.text.strip() if repo_uri_elem else None
        if repos_uri not in ALLOWED_REPOS:
            continue

        github_link_elem = _find(
            group, By.CSS_SELECTOR, 'a[title="View Branch on Github"]'
        )
        github_link = (
            github_link_elem.get_attribute('href') if github_link_elem else None
        )
        if not github_link:
            continue

        links.append(
            TaskLink(repos=repos_uri[5:], pr_id=github_link.rstrip('/').split('/')[-1])
        )

    return links



def build_driver():
    CHROME_DEBUG_PORT = 11213
    profile_dir = 'Profile 1'
    user_data_dir = os.path.expanduser("~/.config/google-chrome-remote")
    subprocess.Popen(["google-chrome", f"--remote-debugging-port={CHROME_DEBUG_PORT}", f"--user-data-dir={user_data_dir}",
        f"--profile-directory={profile_dir}", "--log-level=3"],
        start_new_session=True)
    chrome_options = Options()
    chrome_options.add_argument(f"--remote-debugging-port={CHROME_DEBUG_PORT}")  # Enable debugging
    chrome_options.add_experimental_option("debuggerAddress", f"127.0.0.1:{CHROME_DEBUG_PORT}")  # Connect to existing Chrome
    return webdriver.Chrome(options=chrome_options)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', help='Runbot build URL to scrape')
    parser.add_argument(
        '--timeout', type=int, default=20, help='Seconds to wait for the page'
    )
    args = parser.parse_args()

    driver = build_driver()
    driver.maximize_window()
    try:
        driver.get(args.url)
        WebDriverWait(driver, args.timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div.btn-group'))
        )
        links = extract_tasks_links(driver)
    finally:
        driver.quit()

    # json.dump([asdict(link) for link in links], sys.stdout, indent=2)
    for link in links:
        sys.stdout.write(f'{link.repos},{link.pr_id}\n')

if __name__ == '__main__':
    main()
