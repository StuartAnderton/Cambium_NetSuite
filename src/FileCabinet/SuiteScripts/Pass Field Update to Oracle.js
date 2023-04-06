/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

define(['N/https', 'N/runtime'],

    function (https, runtime) {

        /* function beforeSubmit(context) {

            var isDeletion = context.type === context.UserEventType.DELETE

            if (isDeletion) {

                afterSubmit(context)

                return
            }
        } */

        function afterSubmit(context) {

            var headers;
            var url;
            var payload;
            var response;

            var script = runtime.getCurrentScript();
            var isProduction = runtime.envType === runtime.EnvType.PRODUCTION;
            var customRecordType = 'customrecord_mappings';
            var thisRecordType = context.newRecord.type;
            log.debug('Type', thisRecordType)
            var neoApiCode = script.getParameter({name: 'custscript_neo_api_code_2'})

            if (isProduction) {
                var prefix = script.getParameter({name: 'custscript_production_prefix_2'})
            } else {
                prefix = script.getParameter({name: 'custscript_qa_prefix_2'})
            }

            var customRecord = context.newRecord;

            log.debug("customRecord", customRecord)

            if (thisRecordType === 'customrecord_mappings') {

            var customRecordId = customRecord.getValue('id')

        } else {
                customRecordId = customRecord.getValue('custrecord_field_mapping')

            }

            try {
                // Headers
                headers = {
                    "Content-Type": "application/json",
                    accept: "application/json"
                };

                // Endpoint
                url = "https://" + prefix + "azurewebsites.net/api/attribute-definitions?code=" + neoApiCode;

                log.debug({title: "URL", details: url})

                // Payload
                payload = {
                    EntityType: customRecordType,
                    Id: customRecordId,
                    EventType: context.type
                };

                log.debug("Payload", payload)

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload),
                });

                log.debug("Response", response)

                if (response.code == "204") {
                    log.audit("Attribute Definition Update Requested", customRecordId);
                } else {
                    log.error({ title: "Request failed", details: response.body });
                }
            } catch (err) {
                log.error("Request failed", err);
            }

        }


        return {
            // beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };

    });
