# SHACL-VALIDATOR

A command line SHACL validator

## Depedencies

Node v22.14.0 or better

## Install

```
npm install
```

```
cp .env-sample .env
```

## Usage

Local validate a file

```
npx shacl-validator validate [--shape <shape-file>] [--as [rdf|text]] <data-file>
```

The SHACL shape file may optionally include a "%MainSubject%" string in the object position. 
This string will be replaced by the main subject in the data file (if any).

Start a validation server:

```
npm run server
```

The port and shape-file can also be provided by a `.env` file.

Visit http://localhost:3000/ to see a sample validator application.

Send an example file to the server API:

```
curl -X POST --data-binary @examples/event-notifications/badexample3.jsonld http://localhost:3000/validate
```

## Deployment Hints
 
- Keep `SAFE_MODE=true` in `.env` so JSON-LD `@context` URLs resolve from the cache instead of being fetched (SSRF). 
- The `/validate` endpoint is unauthenticated and CPU-bound, use rate-limit in nginx:

```nginx
# http {}
limit_req_zone $binary_remote_addr zone=validate:10m rate=10r/s;
limit_req_status 429;

# server {}
location = /validate {
    limit_req zone=validate burst=20 nodelay;
    client_max_body_size 16k;
    proxy_pass http://127.0.0.1:3000;
}
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

