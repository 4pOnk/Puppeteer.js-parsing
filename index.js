const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");
const { resolve } = require("path");
const Axios = require("axios");

//CONFIG
let headless = true; // for debugging
let timeOutMultiply = 3; //if TIMEOUT 30000 exeption -> increase it
let token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIE"; //Bearer token
let parsingPeriod = 24; //parsing period (h)
let asynchronously = true; // if asynchronously == false it will be executed in order | else together
//END_CONFIG

let __MAIN = () => {

  //Final compare
  let TOTAL_EVENTS = [];
  let done = (__TOTAL_EVENTS) => {
    console.log(__TOTAL_EVENTS.length + " / " + 4);

    if (!asynchronously) {
      if (__TOTAL_EVENTS.length === 1) _EventsSK();
      else if (__TOTAL_EVENTS.length === 2) _Ict2GO();
      else if (__TOTAL_EVENTS.length === 3) _ItEvents();
    }

    if (__TOTAL_EVENTS.length === 4) {
      let events = [];
      __TOTAL_EVENTS.forEach((el) => {
        events.push(...el);
      });

      let prevSends = JSON.parse(fs.readFileSync("logs.json", "utf8"));
      let sendingLogs = JSON.parse(fs.readFileSync("requests.json", "utf8"));

      console.log("Events found: " + events.length);

      events = events.filter(
        (el, id) =>
          Array.from(events, (el) => el.title)
            .slice(id + 1)
            .indexOf(el.title) === -1
      ); // Убираем совпадения
      events = events.filter((el) => el.photo !== undefined); //Убираем события без фото
      events = events.filter(
        (el) =>
          el.date[0].match(/^[0-9][0-9].[0-9][0-9].[0-9][0-9][0-9][0-9]/) !==
          null
      ); //Убираем события без даты
      events = events.filter((el) => {
        let OK = true;
        el.date.forEach((el1) => {
          if (el1[0] + el1[1] === "00") OK = false;
        });
        return OK;
      }); //Убираем события с неправильной датой
      events = events.filter((el) => prevSends.indexOf(el.title) === -1); //Убираем ранее оправленные события

      console.log("Events sended: " + events.length);

      fs.writeFileSync(
        "logs.json",
        JSON.stringify([...Array.from(events, (el) => el.title), ...prevSends])
      );
      fs.writeFileSync("lastRequest.json", JSON.stringify({ events: events }));
      fs.writeFileSync(
        "requests.json",
        JSON.stringify([...sendingLogs, new Date().getTime()])
      );

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };
      const bodyParameters = JSON.stringify({ events: events });
      if (events.length !== 0)
        Axios.post(
          "http://45.147.177.225:4085/add_events",
          bodyParameters,
          config
        )
          .then(console.log)
          .catch(console.log);
    }
  };

  //event.category_id | string -> int
  let setCategoryId = (str) => {
    switch (str.toLowerCase()) {
      case "конференция":
        return 1;
        break;
      case "онлайн-трансляция":
        return 2;
        break;
      case "форум":
        return 3;
        break;
      case "митап":
        return 4;
        break;
      case "вебинар":
        return 5;
        break;
      case "выставка":
        return 6;
        break;
      case "семинар":
        return 7;
        break;
      case "мастер-класс":
        return 8;
        break;
      case "хакатон":
        return 9;
        break;
      case "конкурс":
        return 9;
        break;
      default:
        return 0;
    }
  };



  //all-events.ru
  let _AllEvents = async () => {
    const browser = await puppeteer.launch({
      //иницилизируем headless браузер
      headless: headless,
      executablePath: "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto("https://all-events.ru/events/"); //Идем на первый сайт

    //Прогружаем все события
    let checkLoadMoreBtns = async () => {
      return await page.evaluate(
        () =>
          Array.from(
            document.querySelectorAll(".open-new"),
            (element) => element.textContent
          ).length
      );
    };
    await new Promise((resolve) => {
      let interval = setInterval(async () => {
        if ((await checkLoadMoreBtns()) === 1) {
          clearInterval(interval);
          resolve();
        } else {
          page.click(".open-new");
        }
      }, 1000);
    }).then(async () => {
      //
      let events = await page.$$eval(
        ".events-list:nth-child(3) .event",
        (
          eventNodes // получаем Node элементы событий
        ) =>
          eventNodes.map((eventNode, id) => {
            let __format = 0;
            let __location = "";
            let __date = [];
            try {
              //Логика обработчика

              //Format
              let EventLocationNode =
                eventNode.children[1].children[2].children[1];
              let loc = EventLocationNode.children[1].innerText;
              if (
                EventLocationNode.children[0].innerText === "" ||
                loc === "площадка уточняется"
              )
                __format = 0;
              else if (
                EventLocationNode.children[0].innerText === "Онлайн-трансляция"
              ) {
                if (
                  loc === " " ||
                  loc === "ОНЛАЙН" ||
                  loc.indexOf("Трансляция на") !== -1 ||
                  loc.match(/([a-zA-Z0-9]+\.[^\s]{2,})/)
                )
                  __format = 1;
                else __format = 3;
              } else __format = 2;

              //Location
              if (__format === 2 || __format === 3) {
                __location = EventLocationNode.children[1].innerText;
              }

              //Date
              let months = [
                "янв",
                "фев",
                "мар",
                "апр",
                "май",
                "июн",
                "июл",
                "авг",
                "сен",
                "окт",
                "ноя",
                "дек",
              ];
              let year = new Date().getFullYear();
              let month = 0;
              let dateStr =
                eventNode.children[1].children[2].children[0].children[0]
                  .innerText;
              let dateArr = dateStr.split(" - ");
              dateArr.forEach((dateEl) => {
                let dateElArr = dateEl.split(" ");
                if (dateElArr.length === 1)
                  dateElArr = [dateElArr[0], "", year];
                else {
                  month = months.indexOf(dateElArr[1]) + 1;
                  dateElArr = [
                    dateElArr[0],
                    (months.indexOf(dateElArr[1]) + 1).toString(),
                    year,
                  ];
                }
                __date.push(dateElArr);
              });
              if (__date[0][1] === "") __date[0][1] = month;
              if (__date.length > 1 && __date[0][1] > __date[1][1])
                __date[1][2]++;
              __date.forEach((el1, id1) => {
                el1.forEach((el2, id2) => {
                  if (el2.length === 1)
                    __date[id1][id2] = "0" + __date[id1][id2];
                });
              });
              __date = __date.map((el) => el.join("."));
            } catch (e) {
              return {};
            }

            // Создаем объект события
            let event = {
              link: eventNode.children[0].href,
              photo:
                "https://all-events.ru" +
                eventNode.children[0].style.backgroundImage.slice(5, -2),
              title: eventNode.children[1].children[1].innerText,
              category_id: eventNode.children[1].children[0].innerText, // ?
              format: __format,
              date: __date,
            };

            //Добавляем условные поля по необходимости
            if (__location.length !== 0) event.location = __location;

            return event;
          })
      );

      events = events.filter((event) => Object.keys(event).length !== 0); // Убираем пустые (Ошибочные)
      events.forEach((el, id) => {
        events[id].category_id = setCategoryId(events[id].category_id);
      });
      new Promise(async (resolve) => {
        //Идем на сайт самого события
        let count = 0;
        events.map(async (event, id) => {
          setTimeout(async () => {
            console.log("all-events.ru || Page " + id);
            let eventPage = await browser.newPage();
            await eventPage.goto(event.link);
            try {
              //Price
              let __price = await eventPage.$eval(
                ".event-pay",
                (e) => e.innerText
              );
              if (__price === "Бесплатно") events[id].price = 0;
              else {
                __price = __price.split(" ").join("");
                if (!isNaN(parseInt(__price))) {
                  events[id].price = parseInt(__price);
                }
              }
              //Закрываем Promise
              count++;
              if (count === events.length) resolve();
            } catch (e) {
              count++;
              if (count === events.length) resolve();
            }

            try {
              //Tags
              let __tags = await eventPage.$eval(
                "#events-list-mob > div > div.events-content > div > div:nth-child(2) > span:nth-child(2)",
                (e) => e.innerText
              );
              events[id].tags = __tags.split(", ");
            } catch (e) {}

            try {
              //Subjects
              let __subjects = await eventPage.$eval(
                "#events-list-mob > div > div.events-content > div > div:nth-child(1) > span:nth-child(2)",
                (e) => e.innerText
              );
              events[id].subjects = __subjects.split(", ");
            } catch (e) {}

            try {
              //Description
              let __description = await eventPage.$eval(
                "#events-list-mob > div > div.events-content",
                (e) => e.innerText
              );
              events[id].description = __description;
            } catch (e) {}

            //Закрываем страницу
            try {
              await eventPage.close();
            } catch (e) {}
          }, id * 500 * timeOutMultiply);
        });
      }).then(() => {
        TOTAL_EVENTS.push(events);
        done(TOTAL_EVENTS);
        browser.close();
      });
      //
    });
  }; 

  //events.sk.ru
  let _EventsSK = () => {
    fetch(
      "https://events.sk.ru/event/ajax/list?start=2000-01-01&end=2100-01-01"
    ) // Получаем первичные данные без парсинга
      .then((response) => response.json())
      .then(async (data) => {
        const browser = await puppeteer.launch({
          //иницилизируем headless браузер
          headless: headless,
          executablePath: "/usr/bin/chromium-browser",
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        let arr = data;
        arr = arr.filter(
          //Убираем не подходящие по времени
          (el) =>
            new Date(el.start).getTime() - new Date().getTime() < 2635200000 &&
            new Date(el.start).getTime() - new Date().getTime() > 0
        );

        let newEvents = arr.map((el, id) => {
          //Заполняем данные из fetch запроса
          let start = new Date(el.start);
          let end = new Date(el.end);

          let addZero = (str) => {
            if (str.toString().length === 1) return "0" + str;
            else return str.toString();
          };

          let event = {
            title: el.title,
            link: el.url,
            date: [
              addZero(start.getDay()) +
                "." +
                addZero(start.getMonth()) +
                "." +
                start.getFullYear() +
                " " +
                addZero(start.getHours()) +
                ":" +
                addZero(start.getMinutes()),
              addZero(end.getDay()) +
                "." +
                addZero(end.getMonth()) +
                "." +
                end.getFullYear() +
                " " +
                addZero(end.getHours()) +
                ":" +
                addZero(end.getMinutes()),
            ],
          };

          return event;
        });

        new Promise(async (resolve) => {
          // Идем на страничку события и берем доп данные оттуда

          let pageCounter = 0;
          newEvents.forEach((event, id) => {
            setTimeout(async () => {
              let eventPage = await browser.newPage();
              await eventPage.goto(event.link);

              console.log("events.sk.ru || Page " + id);

              try {
                newEvents[id].location = await eventPage.$eval(
                  "body > div.container.event-show > div.front > div.front__content > div > div.front__info-wrapper > div:nth-child(1) > p",
                  (e) => e.innerHTML.split("  ").join("")
                );
              } catch (e) {}
              try {
                newEvents[id].organizer = await eventPage.$eval(
                  "body > div.container.event-show > div.front > div.front__content > div > div.front__info-wrapper > div:nth-child(2) > p",
                  (e) => e.innerHTML.split("  ").join("")
                );
              } catch (e) {}
              try {
                newEvents[id].description = await eventPage.$eval(
                  "#event_widgets_About > div > div > div > div > div",
                  (e) => e.innerText.split("  ").join("")
                );
              } catch (e) {}
              try {
                await eventPage.$eval("#registration-tab", (e) =>
                  e.innerText.split("  ").join("")
                );
                newEvents[id].registration_link =
                  newEvents[id].link + "#registration";
              } catch (e) {}
              try {
                newEvents[id].photo = await eventPage.$eval(
                  "body > div.container.event-show > div.front > div.front__content > img",
                  (e) => e.src
                );
              } catch (e) {}

              if (newEvents[id].location === "Онлайн") {
                newEvents[id].format = 1;
              } else {
                newEvents[id].format = 2;
              }

              await eventPage.close();
              if (++pageCounter === newEvents.length) resolve();
            }, id * 700 * timeOutMultiply);
          });
        }).then(() => {
          TOTAL_EVENTS.push(newEvents);
          done(TOTAL_EVENTS);
          browser.close();
        });
      });
  }; 

  //ict2go.ru
  let _Ict2GO = async () => {
    const browser = await puppeteer.launch({
      //иницилизируем headless браузер
      headless: headless,
      executablePath: "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    let date = new Date();
    await page.goto(
      `https://ict2go.ru/events/?region=&event_type=&event_theme=&date_begin=${date.getDate()}.${
        date.getMonth() + 1
      }.${date.getFullYear()}&date_end=${date.getDate()}.${
        ((date.getMonth() + 1) % 12) + 1
      }.${date.getFullYear()}`
    ); //Идем на сайт

    const newEvents = await page.$$eval(
      "body > div.main.container > main > div.index-events > div",
      (events) =>
        events.map((eventNode) => {
          let event = {
            link: eventNode.children[0].href,
            photo: eventNode.children[0].children[0].src,
            date: [eventNode.children[1].children[1].innerText.split(" | ")[0]],
            format:
              eventNode.children[1].children[1].innerText.split(" | ")[1] ===
              "Онлайн"
                ? 1
                : 2,
            title: eventNode.children[1].children[2].innerText,
            organizer: eventNode.children[1].children[0].innerText,
          };

          try {
            let tags = eventNode.children[1].children[3].innerText.split(", ");
            tags[0] = tags[0].split(" ")[1];
            event.tags = tags;
          } catch (e) {}

          try {
            event.category_id =
              eventNode.children[1].children[3].children[0].innerText;
          } catch (e) {}

          return event;
        })
    );

    newEvents.forEach((el, id) => {
      if (newEvents[id].category_id !== undefined)
        newEvents[id].category_id = setCategoryId(newEvents[id].category_id);
    });

    new Promise((resolve) => {
      let pageCounter = 0;
      newEvents.forEach((event, id) => {
        setTimeout(async () => {
          let eventPage = await browser.newPage();
          await eventPage.goto(event.link);

          console.log("ict2go.ru || Page " + id);

          try {
            newEvents[id].registration_link = await eventPage.$eval(
              "body > div.main.container > main > div.main-content > div.event-info.media > div > div > div.event-links > a.register-info.invoke-count",
              (e) => e.href
            );
          } catch (e) {}
          try {
            newEvents[id].description = await eventPage.$eval(
              "body > div.main.container > main > div.main-content > div.tabs > div > div.tab-item.description-info",
              (e) => e.innerText
            );
          } catch (e) {}
          try {
            newEvents[id].date = [
              newEvents[id].date[0] +
                " " +
                (await eventPage.$eval(
                  ".date-info",
                  (e) => e.innerText.match(/[0-9][0-9]:[0-9][0-9]/)[0]
                )),
            ];
          } catch (e) {}

          await eventPage.close();
          if (++pageCounter === newEvents.length) {
            resolve();
          }
        }, id * 500 * timeOutMultiply);
      });
    }).then(() => {
      TOTAL_EVENTS.push(newEvents);
      done(TOTAL_EVENTS);
      browser.close();
    });
  }; 

  //it-events.com
  let _ItEvents = async () => {
    const browser = await puppeteer.launch({
      //иницилизируем headless браузер
      headless: headless,
      executablePath: "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.goto("https://it-events.com/"); //Идем на сайт

    let totalPages = await page.$$eval(
      ".paging__item",
      (pages) => pages.length - 1
    ); // Считаем, сколько всего страниц с событиями
    await page.close();

    let newEvents = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      let page = await browser.newPage();
      await page.goto("https://it-events.com/?page=" + pageNumber);

      newEvents.push(
        ...(await page.$$eval(".event-list-item", (eventsNodes) =>
          eventsNodes.map((eventNode) => {
            let event = {
              photo:
                "https://it-events.com" +
                eventNode.children[0].children[0].children[0].style.backgroundImage.slice(
                  5,
                  -2
                ),
              link: eventNode.children[0].children[0].children[0].href,
              title: eventNode.children[0].children[1].children[1].innerText,
              category_id:
                eventNode.children[0].children[1].children[0].innerText.split(
                  " / "
                )[0],
            };

            try {
              let val = eventNode.children[0].children[1].children[3].innerText;
              if (val !== "ОНЛАЙН-ТРАНСЛЯЦИЯ") {
                event.location = val;
                event.format = 2;
              } else event.format = 1;
            } catch (e) {}

            try {
              let check =
                eventNode.children[0].children[1].children[4].innerText;
              event.format = 3;
            } catch (e) {}

            return event;
          })
        ))
      );

      await page.close();
    }

    new Promise((resolve) => {
      let pageCounter = 0;
      newEvents.forEach((event, id) => {
        newEvents[id].category_id = setCategoryId(newEvents[id].category_id);
        setTimeout(async () => {
          let eventPage = await browser.newPage();
          await eventPage.goto(event.link);

          console.log("it-events.com || Page " + id);

          //Date
          let addZero = (str) => {
            if (str.toString().length === 1) return "0" + str;
            else return str.toString();
          };
          try {
            let months = [
              "ЯНВАРЯ",
              "ФЕВРАЛЯ",
              "МАРТА",
              "АПРЕЛЯ",
              "МАЯ",
              "ИЮНЯ",
              "ИЮЛЯ",
              "АВГУСТА",
              "СЕНТЯБРЯ",
              "ОКТЯБРЯ",
              "НОЯБРЯ",
              "ДЕКАБРЯ",
            ];
            let dateStr = await eventPage.$eval(
              "body > div.event-header > div > div > div.col-md-10 > div.event-header__line.event-header__line_bold.event-header__line_icon",
              (el) => el.innerText
            );
            let dateArr = dateStr.split(" - ");
            dateArr = dateArr.map((el) => el.split(" "));
            if (dateArr[1].length === 1) dateArr = [dateArr[0]];
            dateArr.forEach((el, id) => {
              dateArr[id].splice(3, 1);
              dateArr[id][1] = months.indexOf(dateArr[id][1].toUpperCase()) + 1;

              dateArr[id] =
                addZero(dateArr[id][0]) +
                "." +
                addZero(dateArr[id][1]) +
                "." +
                dateArr[id][2] +
                " " +
                dateArr[id][3];
            });

            newEvents[id].date = dateArr;
          } catch (e) {}

          try {
            newEvents[id].price = await eventPage.$eval(
              ".event-header__line_icon_price",
              (el) => el.innerText.split(": ")[1]
            );
          } catch (e) {}

          try {
            newEvents[id].registration_link = await eventPage.$eval(
              "body > div.event-header > div > div > div.col-md-10 > div.event-header__actions > div > div > a",
              (el) => el.href
            );
          } catch (e) {}

          try {
            newEvents[id].description = await eventPage.$eval(
              "body > div.content > div > div.nav-tabs__bodies > div > div > div > div.col-md-8.user-generated",
              (el) => el.innerText
            );
          } catch (e) {}

          await eventPage.close();
          if (++pageCounter === newEvents.length) resolve();
        }, 500 * id * timeOutMultiply);
      });
    }).then(() => {
      TOTAL_EVENTS.push(newEvents);
      done(TOTAL_EVENTS);
      browser.close();
    });
  }; 

  _AllEvents();
  if (asynchronously) {
    _EventsSK();
    _Ict2GO();
    _ItEvents();
  }
};

__MAIN();
setInterval(__MAIN, parsingPeriod * 60 * 60 * 1000);
