Descripción: Permite a ALMA encolar una tarea para el futuro en la base de datos local usando pg-boss.

Parámetros:

action_type (string): Qué debe hacer (ej. send_telegram_alert, trigger_morning_briefing).

execution_time (string): Fecha y hora en formato ISO 8601.

payload (object): Datos necesarios para ejecutar la acción (ej. {"message": "Revisar el servidor Docker"}).

Filosofía ALMA: Si le dices "Acordate de avisarme mañana a las 9", LOGOS deduce la intención y llama a esta skill. pg-boss en Node.js se encargará de despertar al sistema mañana a las 9:00 exactas.
