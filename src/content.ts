// Textos de la página (ES/EN). Generados a partir de los de nanoredlabs.com.
export interface PageContent {
  metaTitle: string; metaDescription: string; eyebrow: string; h1: string; answer: string; toolTitle: string; howToTitle: string
  howToSteps: [string, string][]
  sections: { title: string; paragraphs?: string[]; list?: string[] }[]
  limitsTitle: string; limits: string[]; faqTitle: string; faqs: [string, string][]
}

export const content: Record<'es' | 'en', PageContent> = {
  "es": {
    "metaTitle": "Anonimizar texto antes de usar ChatGPT, gratis | NanoRed Labs",
    "metaDescription": "Cambia nombres, DNI, IBAN, teléfonos y direcciones por etiquetas antes de pegar un texto en ChatGPT y luego recupera los datos reales. Gratis y en tu navegador.",
    "eyebrow": "Herramienta gratuita · Sin IA generativa",
    "h1": "Anonimizar texto antes de usar ChatGPT",
    "answer": "Esta herramienta gratuita de NanoRed Labs (Málaga) sustituye los datos personales de un texto (nombres, DNI y NIE, CIF, IBAN, teléfonos, emails, direcciones, matrículas y fechas de nacimiento) por etiquetas como [PERSONA_1] o [DNI_1], para que puedas pegarlo en ChatGPT, Claude o Gemini sin dar esos datos. Después devuelve los datos reales a la respuesta. Funciona en tu navegador: el texto no se envía a ningún servidor y la tabla de equivalencias solo vive en la memoria de esta pestaña.",
    "toolTitle": "Anonimiza tu texto",
    "howToTitle": "Cómo se usa",
    "howToSteps": [
      [
        "Pega el texto",
        "Pega el correo, contrato, informe o conversación en la primera caja. La herramienta marca al momento los datos que reconoce."
      ],
      [
        "Revisa lo marcado",
        "En la lista de datos encontrados, desmarca lo que no quieras ocultar y añade a mano lo que falte (un nombre poco común, un proyecto, un cliente)."
      ],
      [
        "Copia el texto anonimizado",
        "Cada dato aparece sustituido por una etiqueta coherente: el mismo nombre es siempre [PERSONA_1]. Cópialo y pégalo en ChatGPT con tu petición."
      ],
      [
        "Devuelve los datos reales",
        "Pega la respuesta de ChatGPT en la segunda caja: las etiquetas se cambian por los datos originales y ya puedes copiar el resultado final."
      ]
    ],
    "sections": [
      {
        "title": "Por qué anonimizar antes de pegar en ChatGPT",
        "paragraphs": [
          "Lo que pegas en un asistente de IA sale de tu ordenador y se procesa en los servidores de quien lo ofrece. Según la cuenta y la configuración, puede guardarse en el historial o usarse para mejorar el modelo. Con datos de clientes, empleados o pacientes, eso es un tratamiento de datos personales que el RGPD te obliga a justificar.",
          "Para la mayoría de tareas (resumir, redactar una respuesta, revisar el tono, ordenar un informe) la IA no necesita saber cómo se llama nadie ni su DNI. Con etiquetas coherentes entiende igual quién es quién y la respuesta sirve igual.",
          "Esta herramienta no sustituye a la política de tu empresa ni a un análisis legal: reduce lo que compartes, pero lo que no detecte o no marques seguirá en el texto."
        ]
      },
      {
        "title": "Qué detecta",
        "list": [
          "DNI, NIE y NIF con su letra de control, y CIF de empresa.",
          "IBAN (españoles y extranjeros) y cuentas antiguas, validados; tarjetas bancarias (algoritmo de Luhn).",
          "Teléfonos españoles e internacionales con prefijo.",
          "Emails y direcciones web.",
          "Direcciones con tipo de vía (calle, avenida, plaza…) y número, y códigos postales con su localidad.",
          "Matrículas de vehículos.",
          "Fechas de nacimiento cuando van con su etiqueta («Fecha de nacimiento», «nacido el»).",
          "Nombres y apellidos frecuentes en España, el nombre que sigue a un saludo o a un tratamiento (Sr., Dña.), la firma tras una despedida y razones sociales con forma jurídica (S.L., S.A.)."
        ]
      }
    ],
    "limitsTitle": "Lo que no detecta (revisa siempre)",
    "limits": [
      "La detección no es perfecta: revisar el texto antes de copiarlo es parte del proceso, no un paso opcional.",
      "Los nombres se reconocen con listas de nombres y apellidos frecuentes y con el contexto, sin IA: se le escapan nombres poco comunes o extranjeros sin saludo ni tratamiento delante, apodos y nombres escritos en minúscula.",
      "Algunos nombres de pila que también son palabras corrientes (Rosa, Victoria, Pilar, Mercedes) no se marcan solos para no tapar texto normal.",
      "No reconoce datos indirectos que identifican a alguien por contexto: un cargo único («la directora de RR. HH.»), un diagnóstico, una historia concreta o el nombre de una empresa sin forma jurídica.",
      "Las fechas solo se marcan si llevan la etiqueta de nacimiento; las demás fechas, importes y números de factura se dejan.",
      "Si la respuesta de ChatGPT cambia una etiqueta (por ejemplo, la traduce o la convierte en «Persona 1»), esa no se podrá devolver: revisa el resultado final."
    ],
    "faqTitle": "Preguntas frecuentes",
    "faqs": [
      [
        "¿Cómo uso ChatGPT sin darle datos personales?",
        "Sustituye los datos por etiquetas antes de pegar el texto: nombres, DNI, teléfonos, cuentas y direcciones. Esta herramienta lo hace por ti en el navegador, te deja revisar qué se tapa y, cuando ChatGPT responde, vuelve a poner los datos reales en su respuesta."
      ],
      [
        "¿Se envía mi texto a algún servidor?",
        "No. La detección y la sustitución se hacen con JavaScript en tu navegador. El texto y la tabla de equivalencias no se envían a ningún servidor, no se guardan en el navegador y desaparecen al cerrar o recargar la pestaña. La analítica de la web solo registra qué botón se pulsa, nunca el contenido."
      ],
      [
        "¿Usa inteligencia artificial para detectar los datos?",
        "No usa IA generativa. Detecta con reglas: patrones, dígitos de control de DNI, NIE, CIF, IBAN y tarjetas, y listas de nombres y apellidos frecuentes en España. Por eso es rápida y no necesita enviar el texto a nadie, pero también por eso puede dejarse algo."
      ],
      [
        "¿Anonimizar así cumple el RGPD?",
        "Ayuda a minimizar los datos que compartes, que es lo que pide el RGPD, pero técnicamente es una seudonimización: con la tabla de equivalencias se puede volver atrás, y lo que no se detecte seguirá en el texto. Revisa siempre el resultado y sigue la política de tu empresa sobre qué se puede pegar en herramientas de IA."
      ],
      [
        "¿Funciona con Claude, Gemini o Copilot?",
        "Sí. El texto anonimizado es texto normal: sirve para cualquier asistente. Solo hace falta que la respuesta conserve las etiquetas tal cual para poder devolver los datos."
      ],
      [
        "¿Qué pasa si ChatGPT cambia las etiquetas?",
        "La herramienta reconoce las etiquetas con o sin corchetes y sin distinguir mayúsculas. Si el asistente las traduce o las reescribe, pídele que mantenga las etiquetas entre corchetes sin cambiarlas, o corrige esas pocas a mano."
      ],
      [
        "¿Puedo marcar un dato que no ha detectado?",
        "Sí. Escríbelo (o selecciónalo en el texto y pulsa «Usar lo seleccionado») y añádelo: se marcarán todas sus apariciones con la misma etiqueta. También puedes desmarcar cualquier dato detectado."
      ],
      [
        "¿Sirve para documentos PDF o facturas?",
        "Esta herramienta es para texto que puedas copiar y pegar. Para tapar datos en una factura en PDF o en una foto, usa nuestro anonimizador de documentos, que también funciona en el navegador."
      ]
    ]
  },
  "en": {
    "metaTitle": "Anonymise text before using ChatGPT, free | NanoRed Labs",
    "metaDescription": "Swap names, ID numbers, IBANs, phones and addresses for tags before pasting text into ChatGPT, then put the real data back. Free and in your browser.",
    "eyebrow": "Free tool · No generative AI",
    "h1": "Anonymise text before using ChatGPT",
    "answer": "This free tool by NanoRed Labs (Málaga, Spain) replaces the personal data in a text (names, Spanish ID numbers, company tax IDs, IBANs, phone numbers, emails, addresses, number plates and dates of birth) with tags such as [PERSON_1] or [ID_1], so you can paste it into ChatGPT, Claude or Gemini without sharing that data. Then it puts the real data back into the answer. It runs in your browser: the text is never sent to a server and the lookup table only lives in this tab’s memory.",
    "toolTitle": "Anonymise your text",
    "howToTitle": "How to use it",
    "howToSteps": [
      [
        "Paste the text",
        "Paste the email, contract, report or conversation into the first box. The tool highlights the data it recognises straight away."
      ],
      [
        "Review what is marked",
        "In the list of data found, untick anything you do not want to hide and add anything missing by hand (an uncommon name, a project, a client)."
      ],
      [
        "Copy the anonymised text",
        "Each item is replaced by a consistent tag: the same name is always [PERSON_1]. Copy it and paste it into ChatGPT with your request."
      ],
      [
        "Put the real data back",
        "Paste ChatGPT’s answer into the second box: the tags are swapped for the original data and you can copy the final result."
      ]
    ],
    "sections": [
      {
        "title": "Why anonymise before pasting into ChatGPT",
        "paragraphs": [
          "Whatever you paste into an AI assistant leaves your computer and is processed on its provider’s servers. Depending on the account and settings, it may be kept in the history or used to improve the model. With data about customers, staff or patients, that is processing of personal data that the GDPR requires you to justify.",
          "For most tasks (summarising, drafting a reply, checking the tone, structuring a report) the AI does not need to know anyone’s name or ID number. With consistent tags it still understands who is who, and the answer is just as useful.",
          "This tool does not replace your company’s policy or legal advice: it reduces what you share, but anything it misses or you do not mark stays in the text."
        ]
      },
      {
        "title": "What it detects",
        "list": [
          "Spanish DNI, NIE and NIF with their check letter, and company CIF.",
          "IBANs (Spanish and foreign) and old Spanish account numbers, validated; bank cards (Luhn algorithm).",
          "Spanish and international phone numbers with a country code.",
          "Email and web addresses.",
          "Addresses with a street type (calle, avenida, plaza…) and number, and postcodes with their town.",
          "Vehicle number plates.",
          "Dates of birth when they come with their label («Date of birth», «Fecha de nacimiento», «born on»).",
          "Common Spanish first names and surnames, the name after a greeting («Dear», «Hola») or a title (Mr, Mrs, Sr., Dña.), the signature after a sign-off and company names with a legal form (S.L., S.A., Ltd)."
        ]
      }
    ],
    "limitsTitle": "What it does not detect (always review)",
    "limits": [
      "Detection is not perfect: reviewing the text before copying it is part of the process, not an optional step.",
      "Names are recognised with lists of common Spanish names and surnames and with context, without AI: it misses uncommon or foreign names with no greeting or title in front, nicknames and names written in lower case.",
      "Some first names that are also common words (Rosa, Victoria, Pilar, Mercedes) are not marked on their own, to avoid covering normal text.",
      "It does not recognise indirect data that identifies someone through context: a unique job title («the HR director»), a diagnosis, a specific story or a company name without a legal form.",
      "Dates are only marked when they carry a birth label; other dates, amounts and invoice numbers are left alone.",
      "If ChatGPT’s answer changes a tag (for example translating it or writing «Person 1»), that one cannot be put back: review the final result."
    ],
    "faqTitle": "Frequently asked questions",
    "faqs": [
      [
        "How can I use ChatGPT without giving it personal data?",
        "Replace the data with tags before pasting the text: names, ID numbers, phones, accounts and addresses. This tool does it for you in the browser, lets you review what is covered and, when ChatGPT answers, puts the real data back into its reply."
      ],
      [
        "Is my text sent to a server?",
        "No. Detection and replacement happen with JavaScript in your browser. The text and the lookup table are not sent to any server, are not stored in the browser and disappear when you close or reload the tab. The website analytics only records which button is pressed, never the content."
      ],
      [
        "Does it use artificial intelligence to find the data?",
        "It does not use generative AI. It works with rules: patterns, check digits for Spanish IDs, IBANs and cards, and lists of common Spanish names and surnames. That is why it is fast and needs to send the text to no one, and also why it can miss something."
      ],
      [
        "Is this GDPR-compliant anonymisation?",
        "It helps you minimise the data you share, which is what the GDPR asks for, but technically it is pseudonymisation: with the lookup table it can be reversed, and anything not detected stays in the text. Always review the result and follow your company’s policy on what can be pasted into AI tools."
      ],
      [
        "Does it work with Claude, Gemini or Copilot?",
        "Yes. The anonymised text is plain text: it works with any assistant. The answer only needs to keep the tags unchanged so the data can be put back."
      ],
      [
        "What if ChatGPT changes the tags?",
        "The tool recognises tags with or without brackets and regardless of case. If the assistant translates or rewrites them, ask it to keep the bracketed tags unchanged, or fix those few by hand."
      ],
      [
        "Can I mark data it did not detect?",
        "Yes. Type it (or select it in the text and press «Use selection») and add it: every occurrence gets the same tag. You can also untick any detected item."
      ],
      [
        "Does it work for PDFs or invoices?",
        "This tool is for text you can copy and paste. To cover data in a PDF invoice or a photo, use our document anonymiser, which also runs in the browser (its interface is in Spanish)."
      ]
    ]
  }
}

export const meta = {
  "site": "https://nanoredlabs.com",
  "repo": "https://github.com/ZzJordan/nanored-text-anonymizer",
  "urls": {
    "es": "https://nanoredlabs.com/herramientas/anonimizar-texto-chatgpt",
    "en": "https://nanoredlabs.com/en/tools/anonymise-text-for-chatgpt"
  },
  "disclaimer": {
    "es": "NanoRed Labs (también escrito «Nano Red Labs») es el negocio de Jordan Moyano en Málaga. No tiene relación con Nano RED Biotechnology ni con otras empresas de nombre parecido.",
    "en": "NanoRed Labs (also written “Nano Red Labs”) is Jordan Moyano’s business in Málaga. It is not related to Nano RED Biotechnology or to other companies with a similar name."
  }
}
