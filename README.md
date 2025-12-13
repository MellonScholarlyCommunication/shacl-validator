# SHACL-VALIDATOR

A command line SHACL validator

## Install

```
npm install
```

## Usage

```
npx shacl-validator [--as [rdf|text]] <shape-file> <data-file>
```

## Report

Possible error reports.

### Everything seems ok

OK - your data input looks good.

### There are some errors

ERROR - your data input has some issues.

**Report**:

 - In https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65
   - 👉 there is an *actor*,
   - ⛔ with more than 1 value.
 - In https://acme.org/events/alice/0F402B08-F676-40EE-9D4B-480B3F985B65
   - 👉 there is an *origin*,
   - ⛔ with a value that does not have shape *agentshape*.
   - Because I see an https://acme.org/system
     - 👉 with an *inbox*,
     - ⛔ with more than 1 value.

