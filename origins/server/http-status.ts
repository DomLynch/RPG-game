// HTTP status codes (RFC 9110) the writer answers with and checks for. The protocol's own numbers, not tuning: each is a named exempt entry in scripts/as-data/allow/origins-server.json.
export const HTTP_OK = 200, HTTP_BAD_REQUEST = 400, HTTP_UNAUTHORISED = 401, HTTP_NOT_FOUND = 404, HTTP_CONFLICT = 409, HTTP_SERVER_ERROR = 500, HTTP_UNAVAILABLE = 503;
