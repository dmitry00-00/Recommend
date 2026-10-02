#!/bin/bash
# Проверка привязок и конвейер данных — вкладка общего пульта (deploy/desk.command): откроется сразу на ней.
exec "$(dirname "$0")/desk.command" check
