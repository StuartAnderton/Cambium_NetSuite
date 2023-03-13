/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */


/**
 *  Update SO address to match
 */


define(['N/https', 'N/runtime', 'N/record', 'N/search'],
    function (https, runtime, record, search) {
        function onAction(scriptContext) {

            log.debug('Starting');

            var context = scriptContext.newRecord;

            var soId = context.getValue({
                fieldId: 'id'
            });

            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: soId
            });

            var soName = salesOrder.getValue({fieldId: 'tranid'});

            var customerId = salesOrder.getValue({
                fieldId: 'entity'
            });

            var customer = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            log.debug('Loaded customer', [customer]);

            var addressCount = customer.findSublistLineWithValue(
                {
                    sublistId: 'addressbook',
                    fieldId: 'defaultshipping',
                    value: true
                }
            )

            var shippingAddressSubrecord = customer.getSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress',
                line: addressCount
            });

            if (shippingAddressSubrecord) {
                var shippingAddrId = shippingAddressSubrecord.getValue({fieldId: 'id'});
            }

            log.debug('loaded address', [shippingAddressSubrecord]);

            salesOrder.setValue({
                fieldId: 'shipAddressList',
                value: 403
            })

            var result = salesOrder.save();

            salesOrder.setValue({
                fieldId: 'shipAddressList',
                value: shippingAddrId
            })

            result = salesOrder.save(

            log.audit('Updated address', [soName, shippingAddrId])


        }

        return {
            onAction: onAction
        }
    });