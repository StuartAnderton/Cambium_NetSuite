/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

define(['N/https', 'N/runtime'],

    function (https, runtime) {

        function afterSubmit(context) {

            var headers;
            var url;
            var payload;
            var response;

            var script = runtime.getCurrentScript();
            var isProduction = runtime.envType === runtime.EnvType.PRODUCTION;
            var customRecordType = script.getParameter({name: 'custscript_custom_record_type'})
            var neoApiCode = script.getParameter({name: 'custscript_neo_api_code'})
            var isDeletion = context.type === context.UserEventType.DELETE

            if (isProduction) {
                var prefix = script.getParameter({name: 'custscript_production_prefix'})
            } else {
                prefix = script.getParameter({name: 'custscript_qa_prefix'})
            }

            var customRecord = context.newRecord;

            log.debug("customRecord", customRecord)

            var customRecordId = customRecord.getValue('id')

            try {
                // Headers
                headers = {
                    "Content-Type": "application/json",
                    accept: "application/json"
                };

                // Endpoint
                url = "https://" + prefix + "azurewebsites.net/api/generic-custom-records?code=" + neoApiCode;

                log.debug({title: "URL", details: url})

                // Payload
                payload = {
                    EntityType: customRecordType,
                    Id: customRecordId
                };

                log.debug("Payload", payload)

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload),
                });

                log.debug("Response", response)

                if (response.code == "204") {
                    log.audit("Custom Record Update Requested", customRecordId);
                } else {
                    log.error({ title: "Request failed", details: response.body });
                }
            } catch (err) {
                log.error("Request failed", err);
            }

        }


        return {
            afterSubmit: afterSubmit
        };

    });
