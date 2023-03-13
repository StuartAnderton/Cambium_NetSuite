/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/runtime', 'N/format'],
    function(record, runtime, format) {
        function onAction(scriptContext) {
            log.debug({
                title: 'Start Script'
            });

            var invoice = scriptContext.newRecord;

            var invoiceId = invoice.getValue({
                fieldId: 'id'
            });

            log.debug('invoice id', invoiceId);

            var subCustomerId = invoice.getValue({
                fieldId: 'entity'
            });

            var amountPaid = invoice.getValue({
                fieldId: 'amountpaid'
            });

            var amountRemaining = invoice.getValue({
                fieldId: 'amountremaining'
            });

            var amount = amountPaid + amountRemaining;

            var transferDate = invoice.getValue({
                fieldId: 'trandate'
            });

            /* var transferDateAsDate = format.format({value:transferDate,type:format.Type.DATE}); */

            var transferDateString = appendLeadingZeroes(transferDate.getDate()) + "/" + appendLeadingZeroes((transferDate.getMonth() + 1))  + "/" +  transferDate.getFullYear() ;

            var transferString = '£' + amount + ' on ' + transferDateString;

            log.audit('Logging transfer', transferString);


            var subCustomer = record.load({
                type: record.Type.CUSTOMER,
                id: subCustomerId
            });

            var customerId = subCustomer.getValue({
                fieldId: 'parent'
            });

            subCustomer.setValue({
                fieldId: 'custentity_most_recent_ct_inv_no',
                value: invoiceId});

            subCustomer.save();

            var parentCustomer = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            parentCustomer.setValue({
                fieldId: 'custentity_most_recent_ct',
                value: transferString});

            parentCustomer.save();

            var contactNote = record.create({
                type: 'customrecord_contact_notes_entry'
            });

            contactNote.setValue({
                fieldId: 'custrecord_cn_customer',
                value: customerId
            });

            contactNote.setValue({
                fieldId: 'custrecord_cn_entry',
                value: 'Cash transfer £' + amount
            });

            contactNote.setValue({
                fieldId: 'custrecord_cn_date_added',
                value: transferDate
            });

            contactNote.setValue({
                fieldId: 'custrecord_cn_added_by',
                value: 68338
            });

            var noteId = contactNote.save();




            return noteId;
        }

        function appendLeadingZeroes(n){
            if(n <= 9){
                return "0" + n;
            }
            return n
        }

        return {
            onAction: onAction
        }
    });