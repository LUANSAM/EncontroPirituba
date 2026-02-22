Deno.serve(async (req) => {
  try {
    const { bookingId, channel } = await req.json();
    return Response.json({
      status: "queued",
      bookingId,
      channel: channel ?? "email",
      note: "Integre provider real (Twilio/SMTP) em produção.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
});
