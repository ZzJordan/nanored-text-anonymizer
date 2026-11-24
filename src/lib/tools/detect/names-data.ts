/**
 * Listas cortas de nombres de pila y apellidos frecuentes en España.
 *
 * Fuente: lista hecha a mano a partir de conocimiento general de los nombres y
 * apellidos más habituales; NO procede de los ficheros del INE. Es deliberadamente
 * corta: sirve para reconocer «Nombre Apellido» sin etiqueta delante, no para
 * cubrir todos los casos. Lo que no esté aquí lo cubren las etiquetas
 * («Cliente:», «Titular:»…) y la revisión manual.
 *
 * Se guardan en minúsculas y sin tildes (ver `fold` en text.ts).
 */

export const FIRST_NAMES: ReadonlySet<string> = new Set([
  // Mujeres
  'maria', 'carmen', 'ana', 'isabel', 'laura', 'cristina', 'marta', 'lucia', 'dolores', 'pilar',
  'josefa', 'elena', 'teresa', 'rosa', 'francisca', 'antonia', 'raquel', 'manuela', 'mercedes',
  'concepcion', 'sara', 'paula', 'patricia', 'beatriz', 'rocio', 'silvia', 'julia', 'nuria',
  'irene', 'andrea', 'monica', 'sonia', 'alicia', 'angela', 'yolanda', 'sofia', 'inmaculada',
  'eva', 'esther', 'noelia', 'veronica', 'natalia', 'claudia', 'alba', 'marina', 'carla',
  'lorena', 'susana', 'rosario', 'encarnacion', 'montserrat', 'amparo', 'nerea', 'aurora',
  'gloria', 'victoria', 'consuelo', 'miriam', 'ines', 'emilia', 'lourdes', 'clara', 'debora',
  'martina', 'valeria', 'daniela', 'carolina', 'alejandra', 'luisa', 'margarita', 'olga',
  // Hombres
  'antonio', 'jose', 'manuel', 'francisco', 'david', 'juan', 'javier', 'daniel', 'carlos',
  'jesus', 'alejandro', 'miguel', 'rafael', 'pedro', 'pablo', 'angel', 'sergio', 'fernando',
  'jorge', 'luis', 'alberto', 'alvaro', 'adrian', 'diego', 'juan', 'raul', 'enrique', 'ramon',
  'vicente', 'ivan', 'ruben', 'oscar', 'andres', 'joaquin', 'santiago', 'eduardo', 'victor',
  'roberto', 'jaime', 'mario', 'ignacio', 'alfonso', 'salvador', 'ricardo', 'marcos', 'jordi',
  'emilio', 'julian', 'julio', 'guillermo', 'gabriel', 'tomas', 'agustin', 'marc', 'gonzalo',
  'felix', 'hugo', 'mateo', 'martin', 'lucas', 'nicolas', 'samuel', 'hector', 'cristian',
  'ismael', 'domingo', 'mariano', 'cesar', 'jordan', 'aitor', 'iker', 'unai', 'xavier', 'xavi',
  'josep', 'joan', 'pau', 'gerard', 'albert', 'nacho', 'paco', 'pepe', 'lola', 'pepa',
]);

export const SURNAMES: ReadonlySet<string> = new Set([
  'garcia', 'rodriguez', 'gonzalez', 'fernandez', 'lopez', 'martinez', 'sanchez', 'perez',
  'gomez', 'martin', 'jimenez', 'hernandez', 'ruiz', 'diaz', 'moreno', 'munoz', 'alvarez',
  'romero', 'gutierrez', 'alonso', 'navarro', 'torres', 'dominguez', 'ramos', 'vazquez',
  'ramirez', 'gil', 'serrano', 'morales', 'molina', 'blanco', 'suarez', 'castro', 'ortega',
  'delgado', 'ortiz', 'marin', 'rubio', 'nunez', 'medina', 'sanz', 'castillo', 'iglesias',
  'cortes', 'garrido', 'santos', 'guerrero', 'lozano', 'cano', 'cruz', 'mendez', 'flores',
  'prieto', 'herrera', 'penas', 'leon', 'marquez', 'cabrera', 'gallego', 'calvo', 'vidal',
  'campos', 'reyes', 'vega', 'fuentes', 'carrasco', 'diez', 'aguilar', 'caballero', 'nieto',
  'santana', 'vargas', 'pascual', 'gimenez', 'herrero', 'hidalgo', 'montero', 'lorenzo',
  'santiago', 'benitez', 'duran', 'ibanez', 'arias', 'mora', 'ferrer', 'carmona', 'vicente',
  'rojas', 'soto', 'crespo', 'roman', 'pastor', 'velasco', 'parra', 'saez', 'moya', 'bravo',
  'rivera', 'gallardo', 'soler', 'pardo', 'esteban', 'franco', 'merino', 'espinosa', 'izquierdo',
  'lara', 'rivas', 'silva', 'rey', 'casado', 'sierra', 'luque', 'redondo', 'montes', 'otero',
  'carrillo', 'marcos', 'vila', 'mateo', 'segura', 'heredia', 'bermudez', 'aranda', 'salazar',
  'robles', 'pena', 'correa', 'nieves', 'quintana', 'acosta', 'escobar', 'manzano', 'cuesta',
  'ponce', 'figueroa', 'bueno', 'cabello', 'palacios', 'contreras', 'avila', 'guzman', 'trujillo',
]);

/** Partículas que pueden ir entre nombre y apellidos («de la Fuente», «del Río»). */
export const NAME_PARTICLES: ReadonlySet<string> = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i']);
