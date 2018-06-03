(function ($) {

    let Subscribes = new function () {
        let pool = {};

        this.call = function (action, payload) {
            if (pool[action]) {
                pool[action].forEach(function (callback) {
                    callback(payload);
                });
            }
        };

        this.addListener = function (action, callback) {
            if (!pool[action]) {
                pool[action] = [];
            }

            pool[action].push(callback);
        };
    };

    let WS = new function () {
        let socket = new WebSocket('ws://192.168.100.5:8666');
        /** TODO: fix hardcoded ws address ^ */

        socket.onopen = function () {
            console.log("Socket opened");
        };

        socket.onclose = function () {
            console.log("Socket closed");
        };

        socket.onerror = function () {
            console.log("Socket error");
        };

        socket.onmessage = function (e) {
            let data = JSON.parse(e.data);

            Subscribes.call(data.action, data.payload);
        };

        this.send = function (data) {

            socket.send(JSON.stringify(data));
        }
    };

    let Login = new function () {
        let loginBlock = $('.login');
        let avatarField = loginBlock.find('input.avatar');
        let loginBt = loginBlock.find('button.make-login');

        loginBt.on('click', makeLogin);

        Subscribes.addListener('login', function(payload){
            Login.avatar = payload.avatar;
        });

        this.avatar = '';

        function makeLogin(e) {
            e.preventDefault();
            let avatar = avatarField.val();
            if (avatar.length < 1) {
                console.log("No avatar set, skipped!");
                return;
            }

            WS.send({
                action: 'login',
                payload: {
                    avatar,
                },
            });
        }
    };

    let Map = new function () {
        let map = $('.map');

        Subscribes.addListener('map', function (payload) {
            map.text(payload.dump);
        });

        $(window).on('keydown', function (e) {

            switch (e.key) {
                case 'ArrowDown':
                    makeMove('down');
                    break;
                case 'ArrowUp':
                    makeMove('up');
                    break;
                case 'ArrowLeft':
                    makeMove('left');
                    break;
                case 'ArrowRight':
                    makeMove('right');
                    break;
            }
        });

        function makeMove(direction) {
            WS.send({
                action: 'move',
                payload: {
                    avatar: Login.avatar,
                    direction: direction,
                },
            });
        }
    };

})(jQuery);