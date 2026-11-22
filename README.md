# Blodslitet statistics

This repository contains historical participations in Blodslitet, for successful completions.
Disqualifications are not counted, regardless of cause.

The data is embedded in `web/fullfort.html`, which is a self contained HTML web page to display and search the statistics.
It relies on an external script to load AG Grid, a performant and feature rich table that can easily handle the 10k+ rows.

## Running the scripts

Prerequisites:

1. Install [Node 26](https://nodejs.org/en/download) or later
2. Run `npm ci`

## History

Until 2024, this was maintained in a MySQL database fronted by PHP scripts.

In 2026, the data from 2024 was cleaned up and converted to a more lightweight format that could be embedded in HTML.
Numbers are encoded with 90 different ASCII characters, reducing the file size by almost 100 kb.

Some names and club names with string encoding issues were corrected using Eventor's competitors registry.

Some names were otherwise correted.

Some names were matched with Eventor id.

The `tools/convert-2024.ts` script was only needed this once,
but is retained in case of a need to investigate inconsistencies in the conversion,
or use for inspiration on how to do more merging.
There are likely many more data quality issues.
