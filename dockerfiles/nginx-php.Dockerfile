FROM trafex/php-nginx:3.0.0
RUN wget https://github.com/vrana/adminer/releases/download/v4.8.1/adminer-4.8.1-mysql-en.php -O adminer.php