/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/https', 'N/runtime'],
    function(https, runtime) {
        function onAction(scriptContext) {
            log.debug({
                title: 'Start Script'
            });
            var newRecord = scriptContext.newRecord;
            var jsonRecord = JSON.stringify(newRecord);
            log.debug({
                title: jsonRecord
            });
            var zapier = runtime.getCurrentScript().getParameter('custscript_new_zapier_endpoint');
            var headers=[];
            headers['Content-Type']='application/json';
            var response = https.post({
                url: zapier,
                body: jsonRecord,
                headers: headers

            });




            return response;
        }
        return {
            onAction: onAction
        }
    });