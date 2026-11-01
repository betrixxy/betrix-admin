# Reels SSH tüneli: yalnız OpenSSH istemcisi. Anahtar imaja girmez, çalışma anında salt okunur bağlanır.
FROM alpine:3.20
RUN apk add --no-cache openssh-client-default && adduser -D -u 1002 tunnel
USER tunnel
