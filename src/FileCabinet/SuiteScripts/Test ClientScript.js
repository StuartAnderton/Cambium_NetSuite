/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/ui/dialog'],

function(dialog) {

    function pageInit(scriptContext) {

        const  message = "Hello, Becky!";

        function success(result) { console.log('Success with value: ' + result) }
        function failure(reason) { console.log('Failure: ' + reason) }

        dialog.alert({
            title: 'I am an Alert',
            message: message
        }).then(success).catch(failure);
    }

    return {
        pageInit: pageInit
    };
    
});
