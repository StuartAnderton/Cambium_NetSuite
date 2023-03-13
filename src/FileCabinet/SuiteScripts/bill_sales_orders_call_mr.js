/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

// Create Invoices from SOs in a SS

define(['N/redirect', 'N/task', 'N/ui/serverWidget', 'N/runtime'],
    function (redirect, task, serverWidget, runtime) {
        function onRequest(request) {

            var deployName = runtime.getCurrentScript().getParameter('custscript_deployname');


            var mapReduceScriptId = 'customscript_bill_sales_orders_mr';
            var deploymentId = deployName
                //'customdeploy_bill_sales_orders_mr';


            var mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: mapReduceScriptId,
                deploymentId: deploymentId
            });
            
            log.debug('Starting', mrTask);

            var mrTaskId = mrTask.submit();

            var html = '<h1>Processing; may take a few seconds. Page will not refresh automatically.</h1>';
            request.response.write({ output: html });

        }


        return {
            onRequest: onRequest
        }
    });
