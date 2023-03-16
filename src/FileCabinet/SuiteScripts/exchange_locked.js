/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

//  Exchanges a locked item on a sales order

define([
    'N/record',
    'N/ui/serverWidget',
    'N/ui/message',
    'N/runtime',
    'N/https',
    'N/redirect',
    'N/crypto'
], function (record, serverWidget, message, runtime, https, redirect, crypto) {

    function onRequest(context) {
        var scriptObj;
        var username;
        var password;
        var apiKey;
        var userObj;
        var userId;
        var user;
        var soItem;
        var isPrezola;
        var vatItem;
        var nonVatItem;
        var isProduction;
        var customer;
        var soId;

        scriptObj = runtime.getCurrentScript();
        username = scriptObj.getParameter({name: 'custscript_cms_username'});
        password = scriptObj.getParameter({name: 'custscript_cms_password'});
        apiKey = runtime.getCurrentScript().getParameter('custscript_neo_apikey');
        vatItem = scriptObj.getParameter({name: 'custscript_vatitem'});
        nonVatItem = scriptObj.getParameter({name: 'custscript_nonvatitem'});
        userObj = runtime.getCurrentUser();
        userId = userObj.id;
        user = userObj.email;
        isProduction = runtime.envType === runtime.EnvType.PRODUCTION;

        log.audit({title: 'Exchange for credit being run by: ' + user});

        if (context.request.method === 'GET') {

            soId = context.request.parameters.soid.match(/(.*)_/)[1];
            customer = getCustomerFromSalesOrder(context, soId);
            isPrezola = isExchangeForPrezola(customer);

            log.debug({title: 'prefix pza qa: ' + getPrefix(runtime, true, false)});
            log.debug({title: 'prefix pza prod: ' + getPrefix(runtime, true, true)});
            log.debug({title: 'prefix neo qa: ' + getPrefix(runtime, false, false)});
            log.debug({title: 'prefix neo prod: ' + getPrefix(runtime, false, true)});


            processGet(context, isPrezola);

        } else {

            soId = context.request.parameters.custpage_salesorder;
            customer = getCustomerFromSalesOrder(context, soId);
            isPrezola = isExchangeForPrezola(customer);

            var model = {
                username: username,
                password: password,
                vatItem: vatItem,
                nonVatItem: nonVatItem,
                user: user,
                userId: userId,
                apiKey: apiKey,
                soItem: soItem,
                isPrezola: isPrezola,
                isProduction: isProduction,
                customer: customer
            };

            processPost(context, model, crypto);
        }
    }

    function processGet(context, isPrezola) {

        //Display confirmation form
        var request = context.request;
        var params = request.parameters;
        var line_num = params.line - 1;
        var id = params.soid;
        var amount = params.amount;
        var quantity = params.quantity;
        var neo_reorder = params.exc;
        var soId = id.match(/(.*)_/)[1];
        var item = params.item;
        var taxcode = params.taxcode;

        var form = serverWidget.createForm({
            title: 'Exchange Item',
            hideNavBar: false,
        });

        var msg = 'Exchange ' + params.name + ' for credit. \n' + 'Change quantity or amount (if available) if you want.\n' + 'Amount will be recalculated automatically if you change quantity.';
        var warning = 'You are about to exchange a Sales Order line for credit. Click Exchange to continue, or hit Back to cancel.';

        form.addPageInitMessage({type: message.Type.WARNING, message: warning});

        var explain = form.addField({
            id: 'custpage_text',
            type: serverWidget.FieldType.TEXT,
            label: 'About to exchange',
        });

        explain.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.INLINE,
        });

        explain.defaultValue = msg;

        var salesorder = form.addField({
            id: 'custpage_salesorder',
            type: serverWidget.FieldType.TEXT,
            label: 'Sales Order',
        });

        salesorder.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        salesorder.defaultValue = soId;

        var soAmount = form.addField({
            id: 'custpage_amount',
            type: serverWidget.FieldType.TEXT,
            label: 'Amount',
        });

        soAmount.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        soAmount.defaultValue = amount;

        var taxCode = form.addField({
            id: 'custpage_taxcode',
            type: serverWidget.FieldType.TEXT,
            label: 'Taxcode',
        });

        taxCode.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        taxCode.defaultValue = taxcode;

        var soItem = form.addField({
            id: 'custpage_item',
            type: serverWidget.FieldType.TEXT,
            label: 'Item',
        });

        soItem.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        soItem.defaultValue = item;

        var soItemName = form.addField({
            id: 'custpage_item_name',
            type: serverWidget.FieldType.TEXT,
            label: 'Item Name',
        });

        soItemName.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        soItemName.defaultValue = params.name;

        var soQuantityField = form.addField({
            id: 'custpage_quantity',
            type: serverWidget.FieldType.INTEGER,
            label: 'Original Quantity',
        });

        soQuantityField.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        soQuantityField.defaultValue = quantity;

        var soNewQuantity = form.addField({
            id: 'custpage_new_quantity',
            type: serverWidget.FieldType.INTEGER,
            label: 'Quantity to exchange',
        });

        soNewQuantity.updateLayoutType({
            layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW,
        });

        soNewQuantity.defaultValue = quantity;

        var soNewAmount = form.addField({
            id: 'custpage_new_amount',
            type: serverWidget.FieldType.CURRENCY,
            label: 'Amount to Credit',
        });

        soNewAmount.updateLayoutType({
            layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW,
        });

        soNewAmount.defaultValue = amount;

        if (!isPrezola) {
            soNewAmount.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN,
            });
        }

        var so_line = form.addField({
            id: 'custpage_so_line',
            type: serverWidget.FieldType.INTEGER,
            label: 'Sales Order Line',
        });

        so_line.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        so_line.defaultValue = line_num;

        var neo_reorder_line = form.addField({
            id: 'custpage_neo_reorder',
            type: serverWidget.FieldType.INTEGER,
            label: 'Neo exchange',
        });

        neo_reorder_line.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN,
        });

        neo_reorder_line.defaultValue = neo_reorder;

        form.addSubmitButton({
            label: 'Exchange',
        });

        context.response.writePage(form);
    }

    function processPost(context, model, crypto) {
        // Process return from confirmation form

        var html = '';

        var request = context.request;
        var params = request.parameters;
        var soId = params.custpage_salesorder;
        var soLine = params.custpage_so_line;
        var oldAmount = params.custpage_amount;
        var newAmount = params.custpage_new_amount;
        var oldQuantity = params.custpage_quantity;
        var newQuantity = params.custpage_new_quantity;
        var itemSku = params.custpage_item;
        var itemName = params.custpage_item_name;
        var itemTaxcode = params.custpage_taxcode;
        var neoReorder = params.custpage_neo_reorder;
        var redirectTo = soId;

        log.debug('Processing', [
            soId, soLine, newAmount, oldAmount, newQuantity, oldQuantity, itemSku
        ]);

        // Basic checks required for both flows
        if (parseFloat(newAmount) > parseFloat(oldAmount) || newAmount <= 0 || parseInt(newQuantity) > parseInt(oldQuantity) || newQuantity <= 0) {

            log.error('Invalid entry', [
                newAmount, oldAmount, newQuantity, oldQuantity
            ]);

            return writeError(context, 'Invalid amount/quantity. Nothing processed.');
        }

        // Get details of the sales order and line item
        var salesOrder = record.load({
            type: record.Type.SALES_ORDER,
            id: soId,
        });

        if (!salesOrder) {
            log.error('Sales Order not loaded', [soId]);
            return writeError(context, 'Failed, nothing processed. (Sales Order failed to load)');
        }

        if (itemTaxcode == 'VAT:S-GB') {
            model.soItem = model.vatItem;
        } else {
            model.soItem = model.nonVatItem;
        }

        var soQuantity = salesOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: soLine,
        });

        if (soQuantity == 0) {

            log.error('Zero quantity returned', [soQuantity]);

            return writeError(context, 'Failed, nothing processed (Zero quantity)');
        }

        var soQuantityBilled = salesOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantitybilled',
            line: soLine
        }) || 0;

        var soDescription = salesOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: soLine,
        });

        var soGrossAmount = salesOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_gross_amount_entry',
            line: soLine,
        });

        if (soGrossAmount == '') {
            soGrossAmount = salesOrder.getSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt',
                line: soLine,
            });
        }

        var soLp = salesOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_originating_list_purchase_id',
            line: soLine,
        });

        if (oldAmount != soGrossAmount) {
            log.error('Amount mismatch', [oldAmount, soGrossAmount]);
            return writeError(context, 'Failed. Nothing processed. (Amount mismatch)');
        }

        // Get information about the customer
        var customerId = salesOrder.getValue({
            fieldId: 'entity',
        });

        var customerExternalId = model.customer.getValue({
            fieldId: 'entityid',
        });

        log.debug('Loaded', [
            customerId,
            customerExternalId,
            model.soItem,
            soQuantity,
            soQuantityBilled,
            soGrossAmount,
        ]);

        var processingModel = {
            salesOrder: salesOrder,
            soQuantity: soQuantity,
            soQuantityBilled: soQuantityBilled,
            soGrossAmount: soGrossAmount,
            soLp: soLp,
            customerId: customerId,
            customerExternalId: customerExternalId,
            itemName: itemName,
            newQuantity: newQuantity,
            newAmount: newAmount,
            oldAmount: oldAmount,
            soLine: soLine,
            itemSku: itemSku,
            neoReorder: neoReorder,
            user: model.user,
            soItem: model.soItem,
            username: model.username,
            password: model.password,
            cmsPrefix: '',
            userId: model.userId,
            soDescription: soDescription,
            apiKey: model.apiKey
        };

        if (model.isPrezola) {


            processingModel.cmsPrefix = getPrefix(runtime, model.isPrezola, model.isProduction);

            var result = PzaExchange(context, processingModel);
            if (result != 0)
                return;
        } else {

            // We are not using the getPrefix method here as these are different from what is stored in the company preferences, these go to Matrix rather than Neo
            if (model.isProduction) {
                processingModel.cmsPrefix = 'oracle-production.';
            } else {
                processingModel.cmsPrefix = 'oracle-qa.';
            }

            var result = TwsWpcExchange(context, processingModel, crypto);

            if (result == -500)
                return;
        }

        log.debug({title: 'Redirect ID', details: redirectTo})

        redirect.toRecord({
            type: record.Type.SALES_ORDER,
            id: redirectTo,
        });
    }

    function PzaExchange(context, model) {

        var wishlistId = model.customerExternalId.match(/^W(.{8})/)[1];
        var notBilled = false;
        var quantityToCredit = 0;
        var amountToCredit = 0;
        var quantityLeft = 0;
        var doneAsExchange = false;
        var cmsResult;
        var html;

        if (!wishlistId) {
            log.error('Wishlist not found', [model.customerId, model.customerExternalId]);
            return writeError(context, 'Failed. Nothing processed. (List not found)');
        }

        // Check if billed
        if (model.soQuantityBilled == 0) {
            // not billed - skip CM
            log.debug('Not billed, no CM needed');

            quantityToCredit = model.newQuantity;
            amountToCredit = model.newAmount;
            notBilled = true;

        } else {
            // Create credit memo
            log.debug('Billed, create CM');

            if (model.newQuantity > model.soQuantityBilled) {
                quantityToCredit = model.soQuantityBilled;
            } else {
                quantityToCredit = model.newQuantity;
            }

            // in case of partial billing

            if (model.oldAmount == model.newAmount) {
                amountToCredit = model.soGrossAmount * (quantityToCredit / model.soQuantity);
            } else {
                amountToCredit = model.newAmount;
            }

            var memoResult = createCreditMemo(
                model.customerId, amountToCredit, quantityToCredit, model.soItem, model.itemName, model.user
            );

            if (memoResult == -1) {

                log.error('Memo create failed', [
                    model.customerId, amountToCredit, quantityToCredit, model.soItem, model.itemName, model.user
                ]);

                return writeError(context, 'Failed, nothing processed. (Could not create Credit Memo)');

            } else {
                log.audit('Credit Memo created', [
                    memoResult, amountToCredit, model.soItem, model.itemName
                ]);
            }
        }

        // Change SO Line amount
        // if not billed, and partial credit

        if (model.soQuantityBilled == 0 && model.newAmount != model.oldAmount) {
            if (model.soQuantity - quantityToCredit == 0) {
                quantityLeft = 1;
            } else {
                quantityLeft = model.soQuantity - quantityToCredit;
            }

            var amountToSet = model.soGrossAmount - amountToCredit;

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_gross_amount_entry',
                line: model.soLine,
                value: amountToSet,
            });

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt',
                line: model.soLine,
                value: amountToSet,
            });
        } else {
            quantityLeft = model.soQuantity - quantityToCredit;
        }

        model.salesOrder.setSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: model.soLine,
            value: quantityLeft,
        });

        if (quantityLeft == 0) {
            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: model.soLine,
                value: 0,
            });
        } else {

            var remaingGrossAmount = (model.soGrossAmount / model.soQuantity) * quantityLeft;

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt',
                line: model.soLine,
                value: remaingGrossAmount,
            });
        }

        try {

            var check = model.salesOrder.save();
            log.audit('SO line zeroed', [check, model.soLine]);

        } catch (err) {

            log.error('SO Save Failed', err);

            return writeError(context, 'Failed, but credit memo created. (Sales Order save failed)');
        }

        // Add credit to CMS
        //try as exchange


        if ((model.soQuantity == quantityToCredit && model.oldAmount == model.newAmount) && model.soLp != '') {

            log.debug({title: 'isPza', details: true});

            cmsResult = exchangeOnCms(model.soLp, model.username, model.password, model.cmsPrefix);

            log.debug('CMS exchange attempt', cmsResult);

            if (cmsResult == -1) {
                log.error('CMS exchange failed', [model.soLp, model.username, model.password, model.cmsPrefix]);
            } else {
                log.audit('lp Exchanged', [model.soLp, cmsResult]);
                doneAsExchange = true;
            }
        } else {
            log.audit('No exchange attempted', [model.soQuantity, quantityToCredit, model.soLp]);
        }

        if (!doneAsExchange) {
            cmsResult = addCmsCredit(wishlistId, amountToCredit, model.username, model.password, model.cmsPrefix);

            log.debug('CMS credit', cmsResult);

            if (cmsResult == -1) {
                log.error('CMS credit add failed', [
                    cmsResult, wishlistId, amountToCredit, model.username, model.password, model.cmsPrefix
                ]);

                return writeError(context, 'Failed, but credit memo created and line zeroed. No credit added to CMS.');

            } else {
                log.audit('CMS credited', [wishlistId, amountToCredit]);
            }
        }

        var noteMessage = '';
        if (doneAsExchange) {
            if (notBilled) {
                noteMessage = 'Credit against Item ' + model.itemSku + ' (' + model.itemName + '): LP ' + model.soLp + ' exchanged on CMS, not billed so no NS credit needed';
            } else {
                noteMessage = 'Credit against Item ' + model.itemSku + ' (' + model.itemName + '): LP ' + model.soLp + ' exchanged on CMS, Credit created on NS for £' + amountToCredit;
            }
        } else {
            if (notBilled) {
                noteMessage = 'Credit against Item ' + model.itemSku + ' (' + model.itemName + '): LP LP NOT exchanged, manual credit created on CMS, not billed so no NS credit needed';
            } else {
                noteMessage = 'Credit against Item ' + model.itemSku + ' (' + model.itemName + '): LP NOT exchanged, manual credit created on CMS, Credit on NS for £' + amountToCredit;
            }
        }

        var noteResult = createContactNote(model.customerId, model.userId, noteMessage);

        if (noteResult == -1) {
            log.error('Note add failed', [model.customerId, model.user, noteMessage]);
            return writeError(context, 'Failed to add note, but all done.');
        } else {
            log.audit('Note created', [model.customerId, model.user, noteMessage]);
        }

        return cmsResult;
    }

    function TwsWpcExchange(context, model, crypto) {

        // Check if billed
        var notBilled = false;
        var quantityToCredit = 0;
        var amountToCredit = 0;
        var quantityLeft = 0;
        var html;


        if (model.soQuantityBilled == 0) {

            notBilled = true;
            quantityToCredit = model.newQuantity;
            amountToCredit = model.newAmount;

        } else {

            if (model.newQuantity > model.soQuantityBilled) {
                quantityToCredit = model.soQuantityBilled;
            } else {
                quantityToCredit = model.newQuantity;
            }

            // in case of partial billing

            if (model.oldAmount == model.newAmount) {
                amountToCredit = model.soGrossAmount * (quantityToCredit / model.soQuantity);
            } else {
                amountToCredit = model.newAmount;
            }
        }

        // Change SO Line amount

        // if not billed, and partial credit

        if (model.soQuantityBilled == 0 && model.newAmount != model.oldAmount) {
            if (model.soQuantity - quantityToCredit == 0) {
                quantityLeft = 1;
            } else {
                quantityLeft = model.soQuantity - quantityToCredit;
            }

            // Update Sales Order
            var amountToSet = model.soGrossAmount - amountToCredit;

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_gross_amount_entry',
                line: model.soLine,
                value: amountToSet,
            });

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt',
                line: model.soLine,
                value: amountToSet,
            });
        } else {
            quantityLeft = model.soQuantity - quantityToCredit;
        }

        model.salesOrder.setSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: model.soLine,
            value: quantityLeft,
        });

        if (quantityLeft == 0) {
            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: model.soLine,
                value: 0,
            });
        } else {
            var remaingGrossAmount = (model.soGrossAmount / model.soQuantity) * quantityLeft;

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt',
                line: model.soLine,
                value: remaingGrossAmount,
            });

            model.salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_gross_amount_entry',
                line: model.soLine,
                value: remaingGrossAmount,
            });
        }

        if (model.soLp != '') {

            log.debug({title: 'isTwsWpc', details: true});

            var itemPrice = model.soGrossAmount / model.soQuantity;

            log.debug('itemPrice', itemPrice);

            var cmsResult = creditOrReorderOnNeo(
                model.soDescription, quantityToCredit, itemPrice,
                model.neoReorder, model.itemName, model.itemSku, model.apiKey,
                model.soLp, crypto, model.cmsPrefix
            );

            log.debug('Neo exchange queued', cmsResult);

            if (cmsResult == -1) {
                log.error('Neo queue failed', [model.soLp, model.username, model.password, model.cmsPrefix]);
                return writeError(context, 'Failed sending credit to Neo');
            } else {
                log.audit('Credit queued', [model.soLp, cmsResult]);

                try {

                    var check = model.salesOrder.save();
                    log.audit('SO line zeroed', [check, model.soLine]);

                } catch (err) {

                    log.error('SO Save Failed', err);

                    return writeError(context, 'Failed, SO could not be saved but credited on Neo');
                }

                if (!notBilled) {
                    // Process credit memo
                    var memoResult = createCreditMemo(
                        model.customerId, amountToCredit, quantityToCredit,
                        model.soItem, model.itemName, model.user
                    );

                    if (memoResult == -1) {

                        log.error('Memo create failed, still queued on Neo', [
                            model.customerId, amountToCredit, quantityToCredit, model.soItem, model.itemName, model.user
                        ]);

                        return writeError(context, 'Exchange has been queued but NetSuite credit memo failed to create');

                    } else {
                        log.audit('Credit Memo created', [
                            memoResult, amountToCredit, model.soItem, model.itemName
                        ]);
                    }
                }
            }
        } else {
            log.audit('No exchange attempted', [model.soQuantity, quantityToCredit, model.soLp]);
        }
    }

    function addCmsCredit(cms_id, credit, username, password, cmsPrefix) {

        var url;
        var response;
        var payload;
        var headers;

        try {
            // Authenticate

            headers = {
                'Content-Type': 'application/json',
                accept: 'application/json',
            };

            payload = {
                username: username,
                password: password,
            };

            url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';

            response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload),
            });

            log.debug('token response', response);
            var body_json = JSON.parse(response.body);
            var token = body_json.token;

            //  Add credit
            headers = {
                'Content-Type': 'application/json',
                accept: 'application/json',
                Authorization: 'JWT ' + token,
            };

            url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cms_id + '/credit_voucher/';

            payload = {
                amount: credit,
            };

            response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (response.code == '200') {
                log.audit('CMS credit, added £' + credit + ' to wishlist ' + cms_id);
                return 0;
            } else {
                log.error('Credit add failed', response.body);
                return -1;
            }
        } catch (err) {
            log.error('Credit add failed', err);
            return -1;
        }
    }

    function exchangeOnCms(lp, username, password, cmsPrefix) {

        var body_json;
        var token;
        var response;
        var url;
        var payload;
        var headers;

        try {
            // Authenticate

            headers = {
                'Content-Type': 'application/json',
                accept: 'application/json',
            };

            payload = {
                username: username,
                password: password,
            };

            url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';

            response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload),
            });

            log.debug('token response', response);
            body_json = JSON.parse(response.body);
            token = body_json.token;

            //  Add credit
            headers = {
                'Content-Type': 'application/json',
                accept: 'application/json',
                Authorization: 'JWT ' + token,
            };

            url = 'https://' + cmsPrefix + 'prezola.com/api/v2/listpurchases/' + lp + '/return/';
            payload = {};

            response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload),
            });

            var body = JSON.parse(response.body);
            var new_lp = body.id;

            if (response.code == '201') {
                log.audit({title: 'LP exchanged, new Lp created', details: new_lp});
                return 0;
            } else {
                log.error({title: 'Exchange failed', details: response.body});
                return -1;
            }
        } catch (err) {
            log.error('Exchange failed', err);
            return -1;
        }
    }

    function creditOrReorderOnNeo(soDescription, quantityToCredit, itemPrice, neoReorder, itemName, itemSku, apiKey, soLp, crypto, cmsPrefix) {

        if (neoReorder == 0) {

            var orderHeaderId = GetNeoOrderHeaderId(soDescription);
            var note = 'Credit against Item ' + itemSku + ' (' + itemName + '): Order ' + orderHeaderId + ' Credit created on NetSuite';

            return exchangeOnNeo(orderHeaderId, soLp, note, quantityToCredit, itemPrice, apiKey, cmsPrefix, crypto);
        } else {
            return reorderOnNeo(soLp, quantityToCredit, apiKey, cmsPrefix, crypto);
        }
    }

    function exchangeOnNeo(orderHeaderId, orderDetailId, note, quantityToCredit, salePrice, key, cmsPrefix, crypto) {
        var response;
        var url;
        var payload;
        var headers;
        var apiKey;

        var inputDate = getDateString();

        var hashObj = crypto.createHash({
            algorithm: crypto.HashAlg.SHA256,
        });

        hashObj.update({
            input: inputDate,
        });

        var hashedValue = hashObj.digest().toLowerCase();
        apiKey = key + hashedValue;

        try {
            // Headers
            headers = {
                'Content-Type': 'application/json',
                accept: 'application/json',
                //apiKey: apiKey,
            };

            // Endpoint
            url = 'https://' + cmsPrefix + 'azurewebsites.net/api/transaction/credit?code=S8bPCKkVjGXZ5hpi1AMI0NkFekcwK7N3mfh27oeIdCMECXCttlxqiA==';

            // Payload
            payload = {
                SalesOrderId: parseInt(orderHeaderId),
                OrderDetailId: parseInt(orderDetailId),
                Notes: note,
                QuantityToCredit: parseInt(quantityToCredit),
                SalePrice: parseFloat(salePrice),
            };

            response = https.put({
                url: url,
                headers: headers,
                body: JSON.stringify(payload),
            });

            log.debug(response);

            if (response.code == '204') {
                log.audit('LP exchanged, credit applied');
                return 1;
            } else {
                log.error({title: 'Credit failed', details: response.body});
                return -1;
            }
        } catch (err) {
            log.error('Credit failed', err);
            return -1;
        }
    }

    function reorderOnNeo(orderDetailId, quantityToCredit, key, cmsPrefix, crypto) {
        var response;
        var url;
        var payload;
        var headers;
        var apiKey;

        var inputDate = getDateString();

        var hashObj = crypto.createHash({
            algorithm: crypto.HashAlg.SHA256,
        });

        hashObj.update({
            input: inputDate,
        });

        var hashedValue = hashObj.digest().toLowerCase();
        apiKey = key + hashedValue;

        try {
            // Headers
            headers = {
                'Content-Type': 'application/json',
                accept: 'application/json',
                apiKey: apiKey,
            };

            // Endpoint
            url = 'https://' + cmsPrefix + 'azurewebsites.net/api/transaction/reorder?code=S8bPCKkVjGXZ5hpi1AMI0NkFekcwK7N3mfh27oeIdCMECXCttlxqiA==';

            log.debug({title: 'Reorder URL', details: url})

            // Payload
            payload = {
                OrderDetailId: parseInt(orderDetailId),
                QuantityToCredit: parseInt(quantityToCredit),
                SalesOrderId: 1,
                Notes: 'SO reordered'
            };

            response = https.put({
                url: url,
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (response.code == '204') {
                log.audit('LP exchanged, new Lp created');
                return 1;
            } else {
                log.error({title: 'Reorder failed', details: response.body});
                return -1;
            }
        } catch (err) {
            log.error('Reorder failed', err);
            return -1;
        }
    }

    function createCreditMemo(customer, amount, quantity, item, exchangedItemName, user) {
        var newCM;

        newCM = record.create({
            type: record.Type.CREDIT_MEMO,
            isDynamic: false,
            defaultValues: {
                entity: customer,
            },
        });

        newCM.setValue({
            fieldId: 'memo',
            value: 'Created by automatic exchange by ' + user,
        });

        newCM.setValue({
            fieldId: 'location',
            value: 1,
        });

        newCM.insertLine({
            sublistId: 'item',
            line: 0,
        });

        newCM.setSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: 0,
            value: quantity,
        });

        newCM.setSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: 0,
            value: item,
        });

        newCM.setSublistValue({
            sublistId: 'item',
            fieldId: 'grossamt',
            line: 0,
            value: amount,
        });

        newCM.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_gross_amount_entry',
            line: 0,
            value: amount,
        });

        newCM.setSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: 0,
            value: exchangedItemName,
        });

        log.debug('newCM', newCM);

        try {
            var check = newCM.save();
            log.debug('CM created', check);
            return check;
        } catch (err) {
            log.error('CM Save Failed', err);
            return -1;
        }
    }

    function createContactNote(customer, user, noteMessage) {
        var note = record.create({
            type: 'customrecord_contact_notes_entry',
            isDynamic: false,
        });

        note.setValue({
            fieldId: 'custrecord_cn_customer',
            value: customer,
        });

        note.setValue({
            fieldId: 'custrecord_cn_entry',
            value: noteMessage,
        });

        var today = new Date();

        note.setValue({
            fieldId: 'custrecord_cn_date_added',
            value: today,
        });

        note.setValue({
            fieldId: 'custrecord_cn_added_by',
            value: user,
        });

        try {
            var check = note.save();
            log.debug('Note created', check);
            return check;
        } catch (err) {
            log.error('Note Failed', err);
            return -1;
        }
    }

    function isExchangeForPrezola(customer) {
        var owning_brand_id = customer.getValue({
            fieldId: 'custentity_owning_brand',
        });

        return owning_brand_id == 9;
    }

    function getCustomerFromSalesOrder(context, salesOrder_id) {
        var html;
        var salesOrder = record.load({
            type: record.Type.SALES_ORDER,
            id: salesOrder_id,
        });

        if (!salesOrder) {
            log.error('Sales Order not loaded', [salesOrder_id]);
            return writeError(context, 'Failed, nothing processed');
        }

        var customerId = salesOrder.getValue({
            fieldId: 'entity',
        });

        var customer = record.load({
            type: record.Type.CUSTOMER,
            id: customerId,
        });

        if (!customer) {
            log.error('Customer not found', [customerId]);
            return writeError(context, 'Failed. Nothing processed.');
        }

        return customer;
    }

    function buildErrorScreen(message) {
        var html = '<div><div style="text-align:center;"><h1>Error processing request</h1><br/><h3>{{message}}</h3><br/><h4>Please contact dev department before trying again</h4></div></div>';
        html = html.replace('{{message}}', message);

        return html;
    }

    function getDateString() {
        var today = new Date();
        return today.getFullYear() + '' + ('0' + (today.getMonth() + 1)).slice(-2) + '' + ('0' + today.getDate()).slice(-2);
    }

    function GetNeoOrderHeaderId(description) {
        return description
            .replace('Order Detail: ', '')
            .replace(' Order Header: ', '|')
            .split('|')[1];
    }

    function writeError(context, message) {
        var html = buildErrorScreen(message);
        context.response.write(html);
        return -500;
    }

    function getPrefix(runtime, isPrezola, isProduction) {
        if (isProduction) {
            if (isPrezola) {
                return getCompanyParameter(runtime, 'custscript_pza_prod_prefix');
            }

            return getCompanyParameter(runtime, 'custscript_neo_prod_prefix');
        }

        if (isPrezola) {
            return getCompanyParameter(runtime, 'custscript_pza_qa_prefix');
        }

        return getCompanyParameter(runtime, 'custscript_neo_qa_prefix');
    }

    function getCompanyParameter(runtime, parameter) {
        var script = runtime.getCurrentScript();
        var value = script.getParameter({name: parameter})

        if (value == null)
            return '';

        return value;
    }

    return {
        onRequest: onRequest,
    };
});