/**
 *@NApiVersion 2.x
 *@NScriptType Portlet
 */
define(['N/search', 'N/ui/serverWidget', 'N/runtime'],
    function(search, serverWidget, runtime) {
        function render(params) {
            var portlet = params.portlet;

            // url is different in Production form sandbox. Will need changing after refresh

            var url;
            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                url = '/app/site/hosting/scriptlet.nl?script=378&deploy=1';
            } else {
                url = '/app/site/hosting/scriptlet.nl?script=381&deploy=1';
            }

            portlet.title = 'Add Credit to CMS';
            var credit = portlet.addField({
                id: 'credit',
                type: 'text',
                label: 'Credit to Add'
            });
            credit.updateLayoutType({
                layoutType: 'normal'
            });
            credit.updateBreakType({
                breakType: 'startcol'
            });
            var username = portlet.addField({
                id: 'username',
                type: 'text',
                label: 'Your CMS username'
            });
            username.updateLayoutType({
                layoutType: 'normal'
            });
            username.updateBreakType({
                breakType: 'startcol'
            });
            var password = portlet.addField({
                id: 'password',
                type: 'text',
                label: 'Your CMS password'
            });
            password.updateLayoutType({
                layoutType: 'normal'
            });
            password.updateBreakType({
                breakType: 'startcol'
            });


            portlet.setSubmitButton({
                url: url,
                label: 'Add Credit',
                target: '_top'
            });


        }
        return {
            render: render
        };
    });
