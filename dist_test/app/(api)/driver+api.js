"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const serverless_1 = require("@neondatabase/serverless");
async function GET(request) {
    try {
        const sql = (0, serverless_1.neon)(`${process.env.DATABASE_URL}`);
        const response = await sql `SELECT * FROM drivers`;
        return Response.json({ data: response });
    }
    catch (error) {
        console.error("Error fetching drivers:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
