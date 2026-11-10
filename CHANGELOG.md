# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- CI now runs a typecheck, a lint pass and a coverage floor on both Ubuntu and Windows.
- A fresh clone builds without the upstream checkout: the committed vendored core is used instead of failing the sync step.
- Every platform checks the repository out with LF, so the Windows matrix no longer reports the pinned files as stale.

## [0.1.0] - 2026-11-05

### Added

- First published version.
