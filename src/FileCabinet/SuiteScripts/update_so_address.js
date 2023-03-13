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

            var customerPhone = customer.getValue({fieldId: 'phone'});

            log.debug('Loaded customer', [customerPhone, customer]);

            var numLines = customer.getLineCount({sublistId: 'addressbook'});

            if (numLines > 0) {
                for (var addressCount = 0; addressCount < numLines; addressCount++) {
                    var addressShipping = customer.getSublistValue({
                        sublistId: 'addressbook',
                        fieldId: 'defaultshipping',
                        line: addressCount
                    });
                    if (addressShipping == true) {
                        break;
                    }
                }
            }

            log.debug('Found ship address at line', [addressCount]);

            if (addressShipping == true) {
                //Select the line set as the default shipping:
                var shippingAddressSubrecord = customer.getSublistSubrecord({
                    sublistId: "addressbook",
                    fieldId: "addressbookaddress",
                    line: addressCount
                }); //Access the addressbookaddress subrecord:
                if (shippingAddressSubrecord) {
                    var addrId= shippingAddressSubrecord.getValue({fieldId: 'id'});
                    var shippingAddr1 = shippingAddressSubrecord.getValue({fieldId: 'addr1'});
                    var shippingAddr2 = shippingAddressSubrecord.getValue({fieldId: 'addr2'});
                    var shippingAddr3 = shippingAddressSubrecord.getValue({fieldId: 'addr3'});
                    var shippingCity = shippingAddressSubrecord.getValue({fieldId: 'city'});
                    var shippingState = shippingAddressSubrecord.getValue({fieldId: 'state'});
                    var shippingZip = shippingAddressSubrecord.getValue({fieldId: 'zip'});
                    var shippingCountry = shippingAddressSubrecord.getValue({fieldId: 'country'});
                    var shippingAddressee = shippingAddressSubrecord.getValue({fieldId: 'addressee'});
                    var shippingAttention = shippingAddressSubrecord.getValue({fieldId: 'attention'});
                    var shippingText = shippingAddressSubrecord.getValue({fieldId: 'addrtext'});
                }
            }

            log.debug('loaded address', [shippingAddressSubrecord]);

            var soShipping = salesOrder.getSubrecord({
                fieldId: 'shippingaddress'
            });

            soShipping.setValue({fieldId: 'addr1', value: shippingAddr1});
            soShipping.setValue({fieldId: 'addr2', value: shippingAddr2});
            soShipping.setValue({fieldId: 'addr3', value: shippingAddr3});
            soShipping.setValue({fieldId: 'city', value: shippingCity});
            soShipping.setValue({fieldId: 'state', value: shippingState});
            soShipping.setValue({fieldId: 'zip', value: shippingZip});
            soShipping.setValue({fieldId: 'country', value: shippingCountry});
            soShipping.setValue({fieldId: 'addressee', value: shippingAddressee});
            soShipping.setValue({fieldId: 'addressee', value: shippingAddressee});
            soShipping.setValue({fieldId: 'addrphone', value: customerPhone});
            soShipping.setValue({fieldId: 'attention', value: shippingAttention});
            soShipping.setValue({fieldId: 'addrtext', value: shippingText});
            
            //soShipping.setValue({fieldId: 'override', value: true});

            salesOrder.setValue({fieldId: 'custbody_bb1_custphone', value: customerPhone});



            //salesOrder.setValue({fieldId: 'shipaddresslist', value: addrId});

            var result = salesOrder.save();

            log.audit('Updated address', [soName, shippingZip, customerPhone])



        }

        return {
            onAction: onAction
        }
    });