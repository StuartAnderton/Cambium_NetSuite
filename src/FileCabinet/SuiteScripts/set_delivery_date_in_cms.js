/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */

/**
 * Uses CMS API to set delivery_date
 * Called by Workflow which triggers on Delivery Date being changed in Netsuite
 */

define(['N/https', 'N/runtime', 'N/record', 'N/format', 'N/redirect'],
    function (https, runtime, record, format, redirect) {
        function onAction(scriptContext) {
            log.debug('Starting', scriptContext)
            var delDate;
            var cmsPrefix;

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                cmsPrefix = '';
            } else {
                cmsPrefix = 'matrix.';
            }

            // get CMS credentials from script deployment record

            var username = runtime.getCurrentScript().getParameter('custscript_username2');
            var password = runtime.getCurrentScript().getParameter('custscript_password2');

            var updatedRecord = scriptContext.newRecord;

            var externalId = updatedRecord.getValue({
                fieldId: 'externalid'
            });
            var regex = /W([0-9]{8})/g;
            var cmsId = regex.exec(externalId)[1];

            var deliveryDate = updatedRecord.getText({
                fieldId: 'custentity_bb1_del_date'
            });

            if (!deliveryDate) {
                deliveryDate = '01/01/2010';
            }


            var delDateString = format.format({
                value: deliveryDate,
                type: format.Type.DATE
            });

            delDate = delDateString.substr(6, 4) + '-' + delDateString.substr(3, 2) + '-' + delDateString.substr(0, 2);



            log.debug('Record to update', [cmsId, delDate]);

            // Authenticate with CMS and get token

            var token = authenticate(username, password, cmsPrefix);

            // Send updated info to CMS

            var result = setCmsDeldate(cmsId, delDate, token, cmsPrefix);

            log.debug('result', result);

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

        function setCmsDeldate(cmsId, delDate, token, cmsPrefix) {

            var headers = {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-HTTP-METHOD-OVERRIDE': 'patch',
                'Authorization': 'JWT ' + token
            };
            var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cmsId + '/';
            var payload = {
                'delivery_date': delDate
            };

            try {
                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                log.error('Error', [cmsId, delDate, token, cmsPrefix, err]);
                return {code: 500}
            }

            return response
        }


        return {
            onAction: onAction
        }
    });