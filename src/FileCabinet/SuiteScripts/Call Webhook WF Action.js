/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/https', 'N/runtime'],
    function(https, runtime) {
        function onAction(scriptContext) {
            var newRecord = scriptContext.newRecord;
            var jsonRecord = JSON.stringify(newRecord);
            log.debug('Processing', jsonRecord);
            var zapier = runtime.getCurrentScript().getParameter('custscript_new_zapier_endpoint');
            var headers=[];
            headers['Content-Type']='application/json';
            var response = https.post({
                url: zapier,
                body: jsonRecord,
                headers: headers
            });
            log.debug('Response', response)
            return response;
        }
        return {
            onAction: onAction
        }
    });