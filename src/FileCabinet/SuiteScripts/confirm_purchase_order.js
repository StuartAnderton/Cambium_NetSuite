/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

//  Confirms a purchase order from a client


define(['N/record'],
    function (record) {
        function onRequest(context) {


            
            // Process return from confirmation form
            var html = '';
           
            var request = context.request;
            var params = request.parameters;
            var id = params.poId;
            
            log.audit({title:'Purchase Order is being confirmed: ' + id});


                var purchaseOrder = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: id
                });

                if (!purchaseOrder) {
                    log.error('Purchase Order not loaded', [id]);
                    html = '<h1>Purchase Order could not be found</h1><br><h2>Please try again later</h2>';
                    context.response.write(html);
                    return
                }

              purchaseOrder.setValue({
                        fieldId: 'custbody_bb1_supplier_confirmed',
                        value: true
                    });

                    try{
                        purchaseOrder.save();

                        log.audit({title:'Purchase Order has been confirmed: ' + id});
                        html = '<h1>Thank you for confirming this purchase order</h1>';
                        context.response.write(html);
                        return;
                    } catch (err) {
                        log.error('Error saving purchase order', [id, err]);
                        html = '<h1>Error while updating Purchase order</h1><br><h2>Please try again later</h2><br/><br/>' + err;
                        context.response.write(html);
                        return;
                    }
        }

        return {
            onRequest: onRequest
        }
    });
