import specification from "../../../../../docs/openapi.json";
export function GET() {
  return Response.json(specification);
}
