/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

// Checks if a new record has an externalID and if not creates one

// Load  standard modules.
define(['N/record'],

    // Add the callback function.
    function (record) {


        function myAfterSubmit(context) {

            log.debug('Processing Starting');
            var checkedRecord = context.newRecord;
            log.debug('Processing', checkedRecord);

            var externalId = checkedRecord.getValue({
                fieldId: 'externalid'
            });



            if (!externalId) {

                var recordType = checkedRecord.type;

                var newExternalId = '';

                var internalId = checkedRecord.getValue({
                    fieldId: 'id'
                });

                var recordToChange = record.load({
                    type: recordType,
                    id: internalId
                });

                if (recordType == 'inventoryitem' | recordType == 'kititem') {
                    newExternalId = 'PP' + internalId.toString().padStart(8, '0');
                    recordToChange.setValue({
                        fieldId: 'itemid',
                        value: newExternalId
                    });

                } else {
                    newExternalId = recordType + '_' + internalId;
                }

                recordToChange.setValue({
                    fieldId: 'externalid',
                    value: newExternalId
                });

                var result = recordToChange.save();

                log.audit('Added External ID to ' + recordType + ' ' + internalId, newExternalId)

                log.debug('Saved', result)

            }

        }

        // Add the return statement that identifies the entry point functions.
        return {
            afterSubmit: myAfterSubmit
        };
    });