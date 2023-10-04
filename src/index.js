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

async function fetchData() {
    book = null;

    try {
        const res = await notion.databases.query({
            database_id: databaseID,
            filter: {
                or: [
                    {
                        property: 'Title',
                        rich_text: {
                            contains: ';'
                        }
                    },
                    {
                        property: 'Author(s)',
                        multi_select: {
                            contains: ';'
                        }
                    },
                    {
                        property: 'Publisher',
                        multi_select: {
                            contains: ';'
                        }
                    }
                ]
            }
        })

        books = res.results.map(book => {
            return {
                title: book.properties.Title.title[0].plain_text,
                author: book.properties["Author(s)"].multi_select[0]?.name ? book.properties['Author(s)'].multi_select[0].name : '',
                publisher: book.properties.Publisher.multi_select[0]?.name ? book.properties.Publisher.multi_select[0].name : ''
            };
        });
        pageId = res.results.map(page => {
            return page.id;
        })
        if (books.length) {
            // console.log(books);
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

                "Pages (Physical)": {
                    number: book.pages ? book.pages : 0,
                },
                Rating: {
                    number: book.rating ? book.rating : 0,
                },

                'Author(s)': {
                    multi_select: [
                        {
                            name: book.authors ? book.authors[0] : null
                        },
                    ]
                },

                Published: {
                    rich_text: [
                        {
                            text: {
                                content: book.publishedDate ? book.publishedDate : 'Not found!'
                            }
                        }
                    ]
                },

                Publisher: {
                    multi_select: [
                        {
                            name: book.publisher ? [book.publisher] : [];
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
    const bookTitle = books[0].title.substring(0, books[0].title.indexOf(';'));
    const bookAuthors = books[0].author ? books[0].author : '';
    // const bookPublisher = books[0].publisher ? books[0].publisher : '';
    const url = `https://www.googleapis.com/books/v1/volumes?q=${bookTitle}+inauthor:${bookAuthors}&key=${googleApiKey}`

    // console.log('bookTITLE:',bookTitle, 'bookAUTHOR:', bookAuthors,'bookPUBLISHER:', bookPublisher)
    try {
        const res = await axios.get(url)
        const bookInfo = await res.data.items;
        const bookInfoMapped = bookInfo.map(book => book.volumeInfo)

        //TODO: Create more efficient method to filter
        const bookInfoFiltered = bookInfoMapped
            .filter(book => book.hasOwnProperty('title'))
            .filter(book => book.title.toUpperCase() === bookTitle.toUpperCase())
            .filter(book => book.language === 'en')

        book = {
            title: bookInfoFiltered[0].title,
            authors: bookInfoFiltered[0].authors,
            publisher: bookInfoFiltered[0].publisher,
            publishedDate: bookInfoFiltered[0].publishedDate,
            description: bookInfoFiltered[0].description,
            pages: bookInfoFiltered[0].pageCount,
            genres: bookInfoFiltered[0].categories,
            rating: bookInfoFiltered[0].averageRating,
        }

        console.log(book);
    } catch (e) {
        console.log(e.message);
    }
}

async function fetchAndUpdateBook() {

    try {
        await fetchData();

        if (book != null) {
            await insertData(book);
        } else {
            console.log('no books found to search!')
        }

    } catch (e) {
        console.log(e);
    }
}

setInterval(fetchAndUpdateBook, 5000);

app.listen(port, () => {
    console.log('Server listening on port 3000');
})
