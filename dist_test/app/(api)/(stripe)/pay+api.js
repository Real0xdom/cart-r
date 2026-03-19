"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const stripe_1 = require("stripe");
const stripe = new stripe_1.Stripe(process.env.STRIPE_SECRET_KEY);
async function POST(request) {
    try {
        const body = await request.json();
        const { payment_method_id, payment_intent_id, customer_id, client_secret } = body;
        if (!payment_method_id || !payment_intent_id || !customer_id) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }
        const paymentMethod = await stripe.paymentMethods.attach(payment_method_id, { customer: customer_id });
        const result = await stripe.paymentIntents.confirm(payment_intent_id, {
            payment_method: paymentMethod.id,
        });
        return new Response(JSON.stringify({
            success: true,
            message: "Payment successful",
            result: result,
        }));
    }
    catch (error) {
        console.error("Error paying:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
        });
    }
}
