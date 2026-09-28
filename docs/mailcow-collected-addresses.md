# Автоматическое сохранение адресатов в SOGo

## Что изменяется

SOGo умеет автоматически добавлять неизвестных получателей исходящих писем в
адресную книгу `collected` («Собранные адреса»). Для этого используются штатные
параметры:

```text
SOGoMailAddOutgoingAddresses = YES;
SOGoSelectedAddressBook = collected;
```

После включения адрес можно найти через автодополнение в поле получателя и в
разделе контактов. Функция применяется к новым исходящим письмам и не извлекает
адреса из старой переписки задним числом.

## Установка на сервер Mailcow

Скопируйте репозиторий или только каталог `deploy/mailcow` на сервер `mcw`, затем
выполните:

```bash
cd /путь/к/cyber-cube-website

sudo bash deploy/mailcow/enable-collected-addresses.sh \
  /opt/mailcow-dockerized
```

Скрипт:

1. проверяет наличие Mailcow, Docker Compose и `sogo.conf`;
2. создаёт резервную копию в `/var/backups/d4-sogo-collected-addresses/`;
3. идемпотентно добавляет или исправляет два параметра;
4. проверяет конфигурацию Docker Compose;
5. перезапускает только `sogo-mailcow` и `memcached-mailcow`;
6. ждёт запуска обоих контейнеров и показывает итоговое состояние;
7. при ошибке возвращает прежний `sogo.conf` и повторно запускает контейнеры.

Почтовая очередь, Postfix, Dovecot, база сообщений и сам сервер не
перезагружаются.

## Как проверить

1. Заново откройте веб-почту.
2. Отправьте письмо на новый тестовый адрес, которого ещё нет в контактах.
3. Создайте ещё одно письмо и начните вводить этот адрес в поле «Кому».
4. Убедитесь, что адрес появился в подсказках и в книге «Собранные адреса».

Для проверки конфигурации на сервере:

```bash
sudo grep -nE \
  'SOGoMailAddOutgoingAddresses|SOGoSelectedAddressBook' \
  /opt/mailcow-dockerized/data/conf/sogo/sogo.conf

cd /opt/mailcow-dockerized
sudo docker compose ps sogo-mailcow memcached-mailcow
```

## Откат

Путь к конкретной резервной копии печатается в строке `Rollback` при установке.
Для ручного отката:

```bash
sudo cp -a \
  /var/backups/d4-sogo-collected-addresses/ДАТА/sogo.conf \
  /opt/mailcow-dockerized/data/conf/sogo/sogo.conf

cd /opt/mailcow-dockerized
sudo docker compose restart memcached-mailcow sogo-mailcow
```

## Почему это находится на стороне Mailcow

Основной сайт только открывает веб-интерфейс почты. Автодополнение получателей и
адресные книги принадлежат SOGo, поэтому изменение JavaScript сайта не решило бы
задачу. Настройка выполняется там, где хранятся контакты, и действует для всех
пользователей веб-почты.

## Официальная документация

- [SOGo Installation and Configuration Guide](https://www.sogo.nu/files/docs/SOGoInstallationGuide.html) — описание `SOGoMailAddOutgoingAddresses` и `SOGoSelectedAddressBook`.
- [Mailcow: SOGo](https://docs.mailcow.email/manual-guides/SOGo/u_e-sogo/) — расположение `data/conf/sogo/sogo.conf` и штатный перезапуск контейнеров SOGo/Memcached.
