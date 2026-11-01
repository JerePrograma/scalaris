// Generated from commercial/portfolio-offer.json by build-portfolio-offer.mjs.
export const priceReferences = {
  "menu": {
    "currency": "ARS",
    "monthlyFrom": 25000,
    "unitLabel": "por negocio",
    "pricingNote": "Referencia para un negocio. Implementación a cotizar tras revisar menú, variantes y material; alcance y aceptación por escrito."
  },
  "mesa": {
    "currency": "ARS",
    "monthlyFrom": 39900,
    "unitLabel": "por local",
    "pricingNote": "Referencia para un local, sujeta a relevamiento y aceptación del piloto. Implementación e integraciones a cotizar."
  },
  "academia": {
    "currency": "ARS",
    "monthlyFrom": 39900,
    "unitLabel": "por institución · una sede",
    "pricingNote": "Programa piloto administrado. El plan depende de alumnos activos; implementación de 1,5 mensualidades, con importación y acompañamiento delimitados en la propuesta.",
    "plans": [
      {
        "id": "estudio",
        "name": "Estudio",
        "monthlyPrice": 39900,
        "studentsMin": 1,
        "studentsMax": 50
      },
      {
        "id": "academia",
        "name": "Academia",
        "monthlyPrice": 59900,
        "studentsMin": 51,
        "studentsMax": 150
      },
      {
        "id": "academia-plus",
        "name": "Academia Plus",
        "monthlyPrice": 89900,
        "studentsMin": 151,
        "studentsMax": 300
      },
      {
        "id": "institucion",
        "name": "Institución",
        "monthlyPrice": 119900,
        "studentsMin": 301,
        "studentsMax": null,
        "requiresQuote": true
      }
    ],
    "billing": {
      "annualDiscountRate": 0.15,
      "implementationMonths": 1.5
    }
  },
  "crm": {
    "currency": "ARS",
    "monthlyFrom": 49900,
    "unitLabel": "por equipo pequeño",
    "pricingNote": "Referencia para un equipo pequeño y una empresa. Usuarios, importación, adaptación y soporte se delimitan en el presupuesto; implementación aparte."
  }
};
