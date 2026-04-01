# Security Policy

## Supported Scope

This project is intended to safely expose Scryfall-backed data and MTG helper workflows through MCP. Security-sensitive areas include:

- request validation and sanitization
- outbound HTTP behavior and rate limiting
- cache bounds and memory usage
- environment-variable handling
- dependency hygiene

## Reporting

Please do not open public issues for suspected vulnerabilities.

Report security concerns by opening a private security advisory on GitHub if available for this repository. If that is not practical, contact the maintainer through a non-public channel before disclosing details publicly.

## What To Include

- a clear description of the issue
- affected files, functions, or tools
- reproduction steps or proof of concept
- impact assessment
- suggested remediation, if known

## Disclosure

Please allow time to validate and remediate the issue before public disclosure. Coordinated disclosure is preferred.
