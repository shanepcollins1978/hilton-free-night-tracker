# Hilton Free Night Tracker Pro

Mobile-friendly Hilton free night spending tracker.

## Trackers

- Shane’s Hilton Surpass: $15,000 annual spending goal
- Diana’s Hilton Surpass: $15,000 annual spending goal
- Shane’s Hilton Aspire Card: $30,000 and $60,000 free night milestones

## CSV Import

The app supports two CSV formats:

1. CSV files exported from this app.
2. American Express activity CSV files with these columns:
   - Date
   - Description
   - Card Member
   - Account #
   - Amount

## Amex Account Routing

Transactions are routed by Account #:

- -41008 → Shane’s Aspire
- -41016 → Shane’s Aspire
- -22005 → Shane’s Surpass
- -72011 → Shane’s Surpass
- -71005 → Diana’s Surpass
- -21031 → Diana’s Surpass

A prior uploaded Amex CSV used -21015 for Diana’s Surpass, so that account suffix is also included as a fallback.

## Import Behavior

- Duplicate transactions are skipped.
- Online payment rows are skipped so payments do not reduce spending progress.
- Refunds or credits that are not payment rows remain in the import and reduce eligible spending.
- An import summary shows imported rows, skipped rows, duplicates, unknown accounts, and amounts imported by tracker.

## Use

Open `index.html` in a browser. Data is stored locally in the browser.
