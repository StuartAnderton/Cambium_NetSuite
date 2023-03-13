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
                url = '/app/site/hosting/scriptlet.nl?script=513&deploy=1';
            }

            portlet.title = 'Exchange LP on CMS';
            var lp = portlet.addField({
                id: 'lp',
                type: 'text',
                label: 'LP to exchange'
            });
            lp.updateLayoutType({
                layoutType: 'normal'
            });
            lp.updateBreakType({
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
                label: 'Exchange LP',
                target: '_top'
            });


        }
        return {
            render: render
        };
    });
