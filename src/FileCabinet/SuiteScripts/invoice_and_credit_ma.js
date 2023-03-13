/**
 *@NApiVersion 2.0
 *@NScriptType MassUpdateScript
 */

/**
 * Script for Jamie to invoice then credit a set of Purchase Orders
 */

define(['N/record', 'N/runtime'],
    function (record, runtime) {


        function each(params) {

            var scriptObj = runtime.getCurrentScript();
            var vatItem = scriptObj.getParameter({name: 'custscript_vatitem_po'});
            var nonVatItem = scriptObj.getParameter({name: 'custscript_nonvatitem_po'});

            log.debug('Parameters', [vatItem, nonVatItem]);

            var recPo = record.load({
                type: params.type,
                id: params.id
            });

            var poNumber = recPo.getValue({
                fieldId: 'tranid'
            });

            var recBill = record.transform({
                fromType: params.type,
                fromId: params.id,
                toType: record.Type.VENDOR_BILL
            });

            recBill.setValue({
                fieldId: 'tranid',
                value: 'Bill created from' + poNumber + ' in mass update'
            });

            recBill.setValue({
                fieldId: 'approvalstatus',
                value: '2'
            });

            recBill.setValue({
                fieldId: 'class',
                value: '7411'
            });

            var billValue = recBill.getValue({
                fieldId: 'total'
            });

            var billId = recBill.save();

            log.audit('Bill created', [billId, poNumber, billValue]);

            log.debug('Processing', [params, recBill]);
            log.debug('Id', billId);

            var recVendorCredit = record.transform({
                fromType: record.Type.VENDOR_BILL,
                fromId: billId,
                toType: record.Type.VENDOR_CREDIT
            });

            recVendorCredit.setValue({
                fieldId: 'tranid',
                value: 'Credit created from' + poNumber + ' in mass update'
            });


            var sublistItems = recVendorCredit.getLineCount({
                sublistId: 'item'
            }) ;

            log.debug('Items to process', sublistItems);

            var type = '';

            for (var i = 0; i < sublistItems; i++) {


                type = recVendorCredit.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'taxcode',
                    line: i
                });

                var amount = recVendorCredit.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                });

                var oldMemo = recVendorCredit.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    line: i
                });


                if (type == '7') {

                    recVendorCredit.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i,
                        value: vatItem
                    });
                    log.debug('Row '+ i, 'Setting Item to VI ' + vatItem)

                } else {
                    recVendorCredit.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i,
                        value: nonVatItem
                    });

                    log.debug('Row '+ i, 'Setting Item to NVI ' + nonVatItem)
                }

                recVendorCredit.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i,
                    value: amount
                });

                recVendorCredit.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'taxcode',
                    line: i,
                    value: type
                });

                recVendorCredit.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    line: i,
                    value: oldMemo
                });

                log.debug('Processed line '+i, [type, amount])


            }

            var creditId = recVendorCredit.save();

            log.audit('Vendor Credit created', [creditId, poNumber, billValue]);


        }

        return {
            each: each
        };
    });