/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */

/**
 * Uses CMS API to set warehouse_status
 * Called by Workflow which triggers on Warehouse Status being changed in Netsuite
 */

define(['N/https', 'N/runtime', 'N/record', 'N/format', 'N/redirect'],
    function (https, runtime, record, format, redirect) {
        function onAction(scriptContext) {
            log.debug('Starting', scriptContext);
            var rtsDate;
            var cmsPrefix;

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                cmsPrefix = '';
            } else {
                cmsPrefix = 'matrix.';
            }

            // get CMS credentials from script deployment record

            var username = runtime.getCurrentScript().getParameter('custscript_username');
            var password = runtime.getCurrentScript().getParameter('custscript_password');

            var updatedRecord = scriptContext.newRecord;

            var externalId = updatedRecord.getValue({
                fieldId: 'externalid'
            });
            var regex = /W([0-9]{8})/g;
            var cmsId = regex.exec(externalId)[1];

            var warehouseStatus = updatedRecord.getText({
                fieldId: 'custentity_bb1_warehouse_status'
            });

            warehouseStatus = formatStatus(warehouseStatus);

            if (warehouseStatus === 'ready_to_send') {

                var rtsDateTime = updatedRecord.getValue({
                    fieldId: 'custentity_ready_to_send_date'
                });

                if (!rtsDateTime) {
                    rtsDateTime = new Date();
                }

                var rtsDateString = format.format({
                    value: rtsDateTime,
                    type: format.Type.DATE
                });
                rtsDate = rtsDateString.substr(6, 4) + '-' + rtsDateString.substr(3, 2) + '-' + rtsDateString.substr(0, 2);

            } else {
                rtsDate = null;
            }

            log.debug('Record to update', [cmsId, rtsDate, warehouseStatus]);

            // Authenticate with CMS and get token

            var token = authenticate(username, password, cmsPrefix);

            // Send updated info to CMS

            var result = setCmsStatus(cmsId, rtsDate, warehouseStatus, token, cmsPrefix);

            log.debug('result', result.code);

            return result.code;
        }

        function authenticate(username, password, cmsPrefix) {

            var headers = {
                'Content-Type': 'application/json',
                "accept": 'application/json'
            };
            var payload = {
                'username': username,
                'password': password
            };
            var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';

            var response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload)
            });

            var body_json = JSON.parse(response.body);
            var token = body_json.token;
            return token;
        }

        function setCmsStatus(cmsId, rtsDate, warehouseStatus, token, cmsPrefix) {

            var headers = {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-HTTP-METHOD-OVERRIDE': 'patch',
                'Authorization': 'JWT ' + token
            };
            var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cmsId + '/';

            var payload = {
                'warehouse_status': warehouseStatus,
                'ready_to_send_date': rtsDate
            };

            try {
                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                log.error('Error', [cmsId, rtsDate, warehouseStatus, token, cmsPrefix, err]);
                return {code: 500}
            }

            return response
        }

        function formatStatus(status) {

            status = status.toLowerCase();
            status = status.replace(/ /g, '_');
            return status
        }

        return {
            onAction: onAction
        }
    });