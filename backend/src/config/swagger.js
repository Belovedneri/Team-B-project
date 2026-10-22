const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Secure IT Helpdesk API',
      version: '1.0.0',
      description:
        'API documentation for the Secure IT Helpdesk Ticketing System.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      {
        name: 'Tickets',
        description: 'Helpdesk ticket operations',
      },
      {
        name: 'Audit Logs',
        description: 'Audit log operations',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
