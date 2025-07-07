export const GET = async () => {
  // The middleware will handle the callback automatically
  return new Response("Authentication successful", { status: 200 });
};
