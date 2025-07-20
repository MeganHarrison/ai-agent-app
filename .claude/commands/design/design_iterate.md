Itterate on a design to create a new UI.

# UI TO BUILD: 
 $ARGUMENTS

## CONSTANTS

Possible paths for UI reference:

* OUTPUT_PATH = `ui_iterations` - Output directory

## VARIABLES

* `n` - Number of concurrent sub-agents

## OBJECTIVE

Launch `n` (default 3) concurrent sub-agents in parallel to develop a single UI concept with different approaches, enabling users to compare options and select the most effective solution.

Instructions for each sub-agent:

### Options

- If the user provides an image use that as the reference for the UI.
- If the user provides a link to a website use that as the reference for the UI.
- If the user provides a file reference use that as the reference for the UI.
- If nothing is provided, stop and ask the user to provide a reference.

### Steps

* Construct a standalone HTML page featuring one interface screen that addresses the user requirements/brief.

* Save HTML files to `OUTPUT_PATH` directory using naming convention `yyyy_mm_dd__ui_{n}.html` (where `n` must be distinct such as `ui_1.html`, `ui_2.html`, etc. and the date is the current date).
