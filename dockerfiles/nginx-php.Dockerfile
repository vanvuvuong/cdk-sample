FROM trafex/php-nginx:3.0.0
RUN mkdir -p /var/www/html/ecs
RUN mv index.php ecs/
RUN mv test.html index.html
RUN wget https://github.com/vrana/adminer/releases/download/v4.8.1/adminer-4.8.1-mysql-en.php -O ecs/adminer.php
