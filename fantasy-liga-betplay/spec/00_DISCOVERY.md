# Discovery — Fantasy Liga BetPlay

## Problem

Los aficionados del fútbol profesional colombiano no tienen una plataforma de Fantasy Football dedicada a la Liga BetPlay Dimayor. Mientras que ligas europeas como la Premier League o LaLiga ofrecen experiencias de fantasy consolidadas con millones de usuarios, los seguidores de la Liga BetPlay — una de las ligas más seguidas en Latinoamérica — carecen de una alternativa local. Actualmente, quienes intentan crear competencias de fantasy entre amigos recurren a hojas de cálculo manuales o grupos de WhatsApp con reglas improvisadas, lo que genera un alto esfuerzo de administración, errores en el conteo de puntos, y una experiencia que no escala más allá de grupos pequeños.

El dolor central es la **brecha entre el engagement emocional** que los aficionados colombianos tienen con su liga local y la **ausencia total de herramientas** que conviertan ese engagement en una experiencia de juego social automatizada. Cada jornada de la Liga BetPlay genera conversaciones, predicciones y debates entre amigos — pero no existe un producto que capture esa energía en un formato estructurado y competitivo.

## Users

### Aficionado casual de la Liga BetPlay
- **Quién:** Hombre o mujer, 18-45 años, residente en Colombia (o colombiano en el exterior).
- **Contexto:** Sigue la Liga BetPlay semanalmente. Ve partidos por televisión o streaming. Participa activamente en conversaciones sobre fútbol en WhatsApp, Twitter/X, o con amigos.
- **Meta:** Quiere una forma divertida y competitiva de demostrar su conocimiento del fútbol colombiano, armando un equipo fantasy y compitiendo contra amigos.
- **Nivel técnico:** Cómodo con apps web móviles, redes sociales, y pagos digitales básicos. No necesita ser gamer ni tener experiencia previa con fantasy sports.

### Organizador de liga entre amigos
- **Quién:** Subconjunto del aficionado casual que toma la iniciativa de crear una liga privada y reclutar participantes.
- **Contexto:** Actualmente es quien arma la hoja de cálculo o el grupo de WhatsApp con reglas. Dedica tiempo extra a calcular puntos manualmente.
- **Meta:** Quiere crear una liga privada con un clic, invitar amigos con un enlace, y que el sistema se encargue de todo el cálculo y administración.
- **Nivel técnico:** Igual que el aficionado casual. No quiere administrar nada — quiere que la plataforma haga el trabajo.

## Success Criteria

1. **Registro a equipo en menos de 5 minutos:** Un usuario nuevo puede registrarse y completar la selección de su squad de 15 jugadores (11 titulares + 4 suplentes) en una sola sesión de menos de 5 minutos.

2. **Actualización automática de puntajes en menos de 2 horas:** Después de que concluye una jornada de la Liga BetPlay, todos los puntajes de fantasy están calculados y los leaderboards actualizados sin intervención manual, dentro de las 2 horas siguientes al pitazo final del último partido de la jornada.

3. **Creación de liga privada en menos de 1 minuto:** Un usuario puede crear una liga privada y obtener un código/enlace de invitación en menos de 60 segundos.

4. **Unirse a liga privada en menos de 30 segundos:** Un usuario que recibe un código de invitación puede unirse a la liga y ver el leaderboard en menos de 30 segundos.

5. **Validación correcta del salary cap:** El 100% de los equipos confirmados cumplen con las reglas de formación (mínimos/máximos por posición) y el presupuesto salarial. No es posible confirmar un equipo inválido.

6. **Bloqueo de transferencias respetado:** Después del deadline de una jornada, el 100% de los intentos de modificación de equipo son rechazados por el sistema hasta que abre la siguiente ventana.

7. **Cálculo correcto del capitán:** Los puntos del capitán designado se multiplican por 2x en el total del usuario. Si el capitán no juega, el vice-capitán recibe multiplicador de 1.5x.

8. **Retención semanal:** Al menos el 60% de los usuarios que crean un equipo en la jornada 1 siguen activos (hacen al menos 1 acción) en la jornada 4.

## Out of Scope

1. **No aplicación móvil nativa** — El MVP es exclusivamente una web app responsive (mobile-first). No se desarrollarán apps para iOS ni Android.
2. **No apuestas con dinero real** — La plataforma es puramente recreativa y social. No involucra transacciones monetarias, premios en efectivo, ni integración con casas de apuestas.
3. **No chat ni mensajería interna** — La comunicación entre usuarios ocurre en canales externos (WhatsApp, redes sociales). La plataforma no incluye sistema de chat, comentarios, ni foros.
4. **No soporte multi-liga** — Solo se cubre la Liga BetPlay Dimayor (Primera A de Colombia). No se incluyen otras ligas colombianas (B, femenina) ni ligas internacionales.
5. **No draft en vivo** — El modelo de armado de equipo es salary cap con mercado abierto (cualquier jugador disponible puede ser seleccionado en cualquier momento dentro de la ventana). No hay mecanismo de draft secuencial tipo NFL.
6. **No contenido editorial** — No se producen noticias, análisis, predicciones ni contenido informativo. La plataforma solo provee datos y mecánica de juego.
7. **No sistema de logros ni badges** — No se implementa gamificación más allá del leaderboard y los puntos de fantasy.
8. **No notificaciones push** — Solo se envían emails básicos para recordar deadlines de jornada. No hay push notifications ni integración con apps de mensajería.
9. **No panel de administración avanzado** — La gestión de datos de jugadores y jornadas se maneja vía scripts y la API de datos. No se construye un backoffice con UI.

## Discovery Confidence
Confidence: medium
Evidence gaps:
- No se ha validado la cobertura real de API-Football para la Liga BetPlay (granularidad de stats por jugador, latencia post-partido, disponibilidad durante cuadrangulares)
- No se ha confirmado si el tier gratuito/freemium de API-Football es suficiente para el volumen de requests del MVP (polling post-partido para ~10 partidos por jornada)
- No existe investigación de mercado con usuarios colombianos reales que valide la demanda y disposición a usar una plataforma de fantasy para la Liga BetPlay
- El formato de torneo de la Liga BetPlay (fase de grupos + cuadrangulares) puede requerir lógica de scoring más compleja que no está especificada aún
Handoff decision: ready — Los gaps son resolvibles durante la fase de requisitos y diseño técnico. El problema está claramente definido y los criterios de éxito son medibles.
