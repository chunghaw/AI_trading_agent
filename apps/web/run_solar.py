from datetime import datetime
import celery.schedules as sc
# celery.schedules.solar.__init__ expects event, lat, lon
try:
    s = sc.solar('sunset', 50.0, 50.0)
    print(s.is_due(datetime.now()))
except Exception as e:
    print(e)
