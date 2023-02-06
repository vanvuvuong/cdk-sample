FROM nginx:1.23.3-alpine
ENTRYPOINT ["tail", "-f", "/dev/null"]