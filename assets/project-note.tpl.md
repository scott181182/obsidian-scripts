# ${name}
#project #github

${description}

## Known Locations
```dataviewjs
const gh = dv.current().file.frontmatter.github;
const headers = ["Location", "Path"];
dv.table(headers, [
	[ "GitHub", gh.url ]
]);
```