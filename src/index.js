const {Client} = require('@notionhq/client');
const express = require('express')
const app = express()
const port = 3000

const axios = require("axios");
require('dotenv').config();


const databaseID = process.env.DATA_BASE_ID;
const googleApiKey = process.env.GOOGLE_API_KEY;
let books;
let book;
let pageId;
const notion = new Client({auth: process.env.NOTION_API_KEY});

async function fetchData () {
    book = null;
    try {
        const res = await notion.databases.query({
            database_id:databaseID,
            filter: {
                property: 'Title',
                rich_text: {
                    contains: ';'
                }
            }

        })
        books = res.results.map(book => {
           return  book.properties.Title.title[0].plain_text;
        });
        pageId = res.results.map(page => {
            return page.id;
        })
        if (books.length) {
            await getBook(books);
        }


    } catch (e) {
        console.log(e);
    }

}

async function insertData(book) {
    try {
        const res = await notion.pages.update({
            parent: {
                database_id: databaseID,
            },
            page_id: pageId,
            properties: {
                Title: {
                    title: [
                        {
                            text: {
                                content: book.title,
                            }
                        }
                    ]
                },
                Pages: {
                    number: book.pages ? book.pages : null,
                },
                Rating: {
                    number: book.rating ? book.rating : null,
                },
                'Author(s)': {
                    multi_select: [
                        {
                            name: book.authors ? book.authors[0] : null
                        }
                    ]
                },
                Published: {
                   rich_text : [
                       {
                           text: {
                               content: book.publishedDate ? book.publishedDate : 'Not found!'
                           }
                       }
                   ]
                },
                Publisher: {
                    rich_text : [
                        {
                            text: {
                                content: book.publisher ? book.publisher : 'Not found!'
                            }
                        }
                    ]
                },
                Description: {
                    rich_text : [
                        {
                            text: {
                                content: book.description ? book.description : 'Not found!'
                            }
                        }
                    ]
                },
                'Genre(s)': {
                    multi_select: [
                        {
                            name: book.genres ? book.genres[0] : 'Not found!'
                        }
                    ]
                }
            }
        })
    } catch (e) {
        console.log(e);
    }

}


async function getBook(books) {
    try {
        const res = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${books[0]}&key=${googleApiKey}`)
        const bookInfo = await res.data.items[0].volumeInfo;
        book = {
            title: bookInfo.title,
            authors: bookInfo.authors,
            publisher: bookInfo.publisher,
            publishedDate: bookInfo.publishedDate,
            description: bookInfo.description,
            pages: bookInfo.pageCount,
            genres: bookInfo.categories,
            rating: bookInfo.averageRating,
        }
        console.log(book);
    } catch (e) {
        console.log(e);
    }

}

async function fetchAndUpdateBook() {
    try{
        await fetchData();
        if (book != null) {
            await insertData(book);
        }else {
            console.log('no books found to search!')
        }
    }catch (e) {
        console.log(e);
    }
}

// app.get('/', async (req, res) => {
     setInterval(fetchAndUpdateBook, 5000);

// })


app.listen(port, () => {
    console.log('Server listening on port 3000');
})