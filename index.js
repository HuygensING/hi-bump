#!/usr/bin/env node

var exec = require('child_process').execSync;
var path = require('path');
var fs = require('fs');
var readline = require("readline-sync");
var semver = require('semver');
var color = require('cli-color');

var red = color.red;
var cyan = color.cyan;
var changelogPath, currentChangelogStr;

var pkg = require(path.resolve(process.cwd(), "package.json"));

var release = process.argv[2];
var nextVersion = "v" + semver.inc(pkg.version, release);

/*
 * Format the commits made between the current version and the next.
 *
 * @return {String} - Formatted (as Markdown) commits with a header and a list of the commits.
 */
function formatLatestCommits() {
	// Create the header ie: ### v2.5.3 (2015/04/03 13:28)
	var d = new Date();
	var formattedDate = "\t(" + d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " + d.getHours() + ":" + d.getMinutes() +")";
	var header = "### " + nextVersion + formattedDate;

	// Get a list of all commit message between the previous tag and HEAD.
	var latestCommits = exec("git log v"+pkg.version+"..HEAD --pretty=format:'* %s'", {encoding: "utf-8"});
	// Remove all the bump commit messages
	var lines = latestCommits.split('\n');

	return header + "\n" + lines.join("\n") + "\n\n"
}

/*
 * Log error messages
 *
 * @param {String} errorMessage
 */
function logError(errorMessage) {
	console.log(red("HiBump error: "), errorMessage);
}

// Exit if patch, minor or major aren't given.
if (["major", "minor", "patch"].indexOf(release) == -1) {
	logError("Missing an argument (patch/minor/major)!");
	console.error("For example: `hi-bump patch`");
	process.exit();
}

// Let the user confirm the version upgrade.
var question = "Upgrade the " + cyan(release) + " version to " + cyan(nextVersion) + "?";
if (!readline.keyInYNStrict(question)) {
	console.log(red("HiBump exiting..."));
	process.exit();
}

// Check if the current version is available as a git tag.
// If it is not, the script will fail, because the commits
// between the current version and the next version cannot
// be found.
var gitTagStdout = exec("git tag", {encoding: "utf-8"});
var gitTags = gitTagStdout.split(/\r?\n/);
if (gitTags.indexOf("v" + pkg.version) === -1) {
	logError("Current version not found as git tag!");
	process.exit();
}

// Read the current CHANGELOG.md
try {
	changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
	currentChangelogStr = fs.readFileSync(changelogPath, "utf-8");
} catch (e) {
	// If it does not exist, create it.
	if (e.code === 'ENOENT') {
		currentChangelogStr = fs.writeFileSync(changelogPath, "");
	} else {
		throw e;
	}
}

// Get the commits that are not released yet.
var latestCommits = formatLatestCommits();
// Concatenate the current with the new.
var newChangelogStr = latestCommits + currentChangelogStr;
// Write the new changelog.
fs.writeFileSync(changelogPath, newChangelogStr);
console.log(cyan("Changelog written!\n\n"), latestCommits);

// Push to git and publish to NPM.
exec("npm --no-git-tag-version version " + release);
exec("git add -A && git commit -m \"Bump to " + nextVersion + "\" && git tag " + nextVersion);
exec("git push && git push --tags");
exec("npm publish");