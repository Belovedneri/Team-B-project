
import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Secure IT Helpdesk API",
      version: "1.0.0",
      description:
        "API documentation for the Secure IT Helpdesk Ticketing System.",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Local development server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Backend health checks",
      },
      {
        name: "SLA",
        description: "Ticket service-level agreement tracking",
      },
    ],
  },
  apis: ["./src/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check whether the API is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running
 */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    message: "Secure IT Helpdesk API is running",
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Helpdesk API running at http://localhost:${PORT}`);
  console.log(`Swagger documentation at http://localhost:${PORT}/api-docs`);
});